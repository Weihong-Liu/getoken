// Package mail provides a small abstraction over outbound transactional email
// so the auth layer can stay ESP-agnostic. Pick the backend at boot via the
// MAIL_PROVIDER env: "resend" (HTTP API), "smtp" (any SMTP server, e.g.
// self-hosted Postal or a SaaS that exposes SMTP), or "" (no-op fallback).
package mail

import (
	"context"
	"strings"

	"go.uber.org/zap"

	"github.com/puppet/getoken/server/internal/config"
)

// Sender is what auth handlers depend on. Implementations should be safe to
// call from multiple goroutines and must respect ctx cancellation.
type Sender interface {
	// Send delivers htmlBody to a single recipient. The implementation may
	// queue or fan out; auth code treats success as "ESP accepted, delivery
	// not guaranteed". Errors should be returned for visibility (logged by
	// caller) but should NOT block the calling flow — the verification code
	// is already persisted in Redis, so a failure to send only means the
	// user needs to request a fresh code, not that the system is broken.
	Send(ctx context.Context, to, subject, htmlBody string) error
}

// New selects a backend based on cfg. Falls back to the no-op sender if no
// provider is configured, so unit tests and local dev keep working without
// SMTP / Resend credentials.
func New(cfg *config.Config, log *zap.Logger) Sender {
	provider := strings.ToLower(strings.TrimSpace(cfg.MailProvider))
	switch provider {
	case "resend":
		if cfg.ResendAPIKey == "" || cfg.SMTPFrom == "" {
			log.Warn("mail provider=resend but RESEND_API_KEY or SMTP_FROM missing; falling back to noop")
			return &NoopSender{log: log}
		}
		return NewResendSender(cfg.ResendAPIKey, cfg.SMTPFrom, log)
	case "smtp":
		if cfg.SMTPHost == "" || cfg.SMTPFrom == "" {
			log.Warn("mail provider=smtp but SMTP_HOST or SMTP_FROM missing; falling back to noop")
			return &NoopSender{log: log}
		}
		return NewSMTPSender(SMTPConfig{
			Host:     cfg.SMTPHost,
			Port:     cfg.SMTPPort,
			Username: cfg.SMTPUsername,
			Password: cfg.SMTPPassword,
			From:     cfg.SMTPFrom,
			UseTLS:   cfg.SMTPUseTLS,
		}, log)
	default:
		// Empty / unknown provider: log code to stdout so dev registration works.
		if provider != "" {
			log.Warn("unknown MAIL_PROVIDER; falling back to noop", zap.String("provider", provider))
		}
		return &NoopSender{log: log}
	}
}
