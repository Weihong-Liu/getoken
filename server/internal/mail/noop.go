package mail

import (
	"context"

	"go.uber.org/zap"
)

// NoopSender is the dev / unconfigured fallback. It logs the call but never
// hits the network. The verification code itself is NOT logged in production
// to keep server logs free of credential material — only the recipient and
// subject are recorded so operators can confirm the flow is reaching the
// mailer. Local dev sees the code via the /api/auth/send-code response
// `devCode` field, which is gated on ENV=development upstream.
type NoopSender struct {
	log *zap.Logger
}

func (s *NoopSender) Send(_ context.Context, to, subject, _ string) error {
	s.log.Warn("mail noop: not actually sent (MAIL_PROVIDER unset)",
		zap.String("to", to), zap.String("subject", subject))
	return nil
}
