package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.uber.org/zap"
)

const resendAPIEndpoint = "https://api.resend.com/emails"

// ResendSender posts to Resend's HTTP API. We avoid pulling in the official
// SDK because the surface we use is tiny — one POST with a JSON body — and
// the SDK would add ~4 transitive modules for no benefit.
type ResendSender struct {
	apiKey string
	from   string
	client *http.Client
	log    *zap.Logger
}

func NewResendSender(apiKey, from string, log *zap.Logger) *ResendSender {
	return &ResendSender{
		apiKey: apiKey,
		from:   from,
		client: &http.Client{Timeout: 10 * time.Second},
		log:    log,
	}
}

type resendPayload struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

func (s *ResendSender) Send(ctx context.Context, to, subject, htmlBody string) error {
	payload, err := json.Marshal(resendPayload{
		From: s.from, To: []string{to}, Subject: subject, HTML: htmlBody,
	})
	if err != nil {
		return fmt.Errorf("marshal resend payload: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, resendAPIEndpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("new resend request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("resend http: %w", err)
	}
	defer resp.Body.Close()
	// Resend returns 200 OK with {id: "..."} on success; surface the body on
	// non-2xx so operators see Resend's specific error code (rate limit,
	// domain not verified, etc.) in server logs.
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("resend status %d: %s", resp.StatusCode, string(body))
	}
	s.log.Info("mail sent via resend", zap.String("to", to), zap.String("subject", subject))
	return nil
}
