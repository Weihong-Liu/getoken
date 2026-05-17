package mail

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"

	"go.uber.org/zap"
)

// SMTPConfig captures the minimum knobs we need to talk to any SMTP server —
// whether that's a SaaS that exposes SMTP (SendGrid, Brevo, Mailgun), a
// self-hosted Postal/Postfix instance, or a corporate relay.
type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
	UseTLS   bool // true → implicit TLS on port 465; false → STARTTLS on 587 if offered
}

const (
	smtpDialTimeout = 10 * time.Second
	smtpIOTimeout   = 20 * time.Second
)

// SMTPSender speaks SMTP directly without third-party SDKs. We replace
// smtp.SendMail's all-or-nothing convenience with an explicit dial so we can
// enforce timeouts and opportunistic STARTTLS, and so we can sanitize
// header fields against CR/LF injection.
type SMTPSender struct {
	cfg SMTPConfig
	log *zap.Logger
}

func NewSMTPSender(cfg SMTPConfig, log *zap.Logger) *SMTPSender {
	if cfg.Port == 0 {
		if cfg.UseTLS {
			cfg.Port = 465
		} else {
			cfg.Port = 587
		}
	}
	return &SMTPSender{cfg: cfg, log: log}
}

func (s *SMTPSender) Send(_ context.Context, to, subject, htmlBody string) error {
	// We ignore ctx for SMTP because net/smtp doesn't accept one; the dial
	// + IO deadlines below cap latency at ~30s regardless of caller ctx.
	cfg := s.cfg
	to = sanitizeHeader(to)
	subject = sanitizeHeader(subject)
	from := sanitizeHeader(cfg.From)

	msg := buildMIMEMessage(from, to, subject, htmlBody)
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)

	if cfg.UseTLS {
		return s.sendTLS(addr, auth, cfg.From, to, msg, cfg.Host)
	}
	return s.sendSTARTTLS(addr, auth, cfg.From, to, msg, cfg.Host)
}

func (s *SMTPSender) sendSTARTTLS(addr string, auth smtp.Auth, from, to string, msg []byte, host string) error {
	dialer := &net.Dialer{Timeout: smtpDialTimeout}
	conn, err := dialer.Dial("tcp", addr)
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	_ = conn.SetDeadline(time.Now().Add(smtpIOTimeout))
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("new smtp client: %w", err)
	}
	defer client.Close()

	// Upgrade if the server advertises STARTTLS. Refusing to send over
	// plaintext when the server supports TLS is the right default; if a
	// server genuinely doesn't support TLS the operator can run an STunnel.
	if ok, _ := client.Extension("STARTTLS"); ok {
		if err = client.StartTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}); err != nil {
			return fmt.Errorf("starttls: %w", err)
		}
	}
	return s.deliver(client, auth, from, to, msg)
}

func (s *SMTPSender) sendTLS(addr string, auth smtp.Auth, from, to string, msg []byte, host string) error {
	dialer := &net.Dialer{Timeout: smtpDialTimeout}
	conn, err := tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{
		ServerName: host, MinVersion: tls.VersionTLS12,
	})
	if err != nil {
		return fmt.Errorf("tls dial: %w", err)
	}
	_ = conn.SetDeadline(time.Now().Add(smtpIOTimeout))
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("new smtp client: %w", err)
	}
	defer client.Close()
	return s.deliver(client, auth, from, to, msg)
}

func (s *SMTPSender) deliver(client *smtp.Client, auth smtp.Auth, from, to string, msg []byte) error {
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}
	if err := client.Mail(from); err != nil {
		return fmt.Errorf("smtp mail: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err = w.Write(msg); err != nil {
		return fmt.Errorf("write msg: %w", err)
	}
	if err = w.Close(); err != nil {
		return fmt.Errorf("close writer: %w", err)
	}
	// Ignore Quit errors — some servers return non-RFC-compliant responses
	// after data delivery is already successful.
	_ = client.Quit()
	s.log.Info("mail sent via smtp", zap.String("to", to))
	return nil
}

func buildMIMEMessage(from, to, subject, htmlBody string) []byte {
	return []byte(fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		from, to, subject, htmlBody,
	))
}

// sanitizeHeader strips CR/LF so a hostile user-controlled value can't inject
// additional SMTP headers (e.g. Bcc, X-Mailer overrides). Standard mitigation
// — see RFC 5322 §2.2 for the prohibition on bare CR/LF inside header fields.
func sanitizeHeader(s string) string {
	s = strings.ReplaceAll(s, "\r", "")
	s = strings.ReplaceAll(s, "\n", "")
	return s
}
