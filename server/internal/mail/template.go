package mail

import (
	"fmt"
	"html"
)

// VerifyCodeBody returns the HTML used for both registration and
// password-reset verification codes. Inline CSS only — many email clients
// (Outlook, Gmail mobile) drop <style> blocks or external sheets.
//
// The code is HTML-escaped defensively even though it's generated from a
// digits-only RNG upstream — paranoia is cheap, and keeps this template
// safe if a future caller passes in something less constrained.
func VerifyCodeBody(siteName, code string) string {
	siteName = html.EscapeString(siteName)
	code = html.EscapeString(code)
	return fmt.Sprintf(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow:hidden;">
    <div style="padding:24px 32px;background:linear-gradient(135deg,#6366f1 0%%,#8b5cf6 100%%);color:#fff;">
      <h1 style="margin:0;font-size:20px;font-weight:600;">%s 验证码</h1>
    </div>
    <div style="padding:32px;text-align:center;color:#1f2937;">
      <p style="margin:0 0 16px;font-size:14px;color:#4b5563;">您的验证码：</p>
      <div style="display:inline-block;padding:16px 28px;font-family:'SF Mono',Menlo,monospace;font-size:32px;font-weight:600;letter-spacing:6px;background:#f3f4f6;border-radius:6px;color:#111827;">%s</div>
      <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">10 分钟内有效。如果不是您本人操作，请忽略此邮件。</p>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;color:#9ca3af;font-size:12px;text-align:center;">
      本邮件由系统自动发送，请勿回复。
    </div>
  </div>
</body></html>`, siteName, code)
}
