package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/puppet/getoken/server/internal/audit"
	"github.com/puppet/getoken/server/internal/config"
	mailpkg "github.com/puppet/getoken/server/internal/mail"
	"github.com/puppet/getoken/server/internal/middleware"
	"github.com/puppet/getoken/server/internal/pkg/errkit"
	"github.com/puppet/getoken/server/internal/pkg/idgen"
	"github.com/puppet/getoken/server/internal/response"
	"github.com/puppet/getoken/server/internal/store"
)

type Handler struct {
	cfg    *config.Config
	s      *store.Store
	log    *zap.Logger
	mailer mailpkg.Sender
}

func NewHandler(cfg *config.Config, s *store.Store, log *zap.Logger, mailer mailpkg.Sender) *Handler {
	return &Handler{cfg: cfg, s: s, log: log, mailer: mailer}
}

func (h *Handler) emitAudit(c *gin.Context, action, target string, detail any) {
	ev := audit.Event{Action: action, Target: target, Detail: detail, IP: c.ClientIP()}
	if u := middleware.CurrentUser(c); u != nil {
		ev.ActorID = u.ID
	}
	audit.Emit(h.s.DB, h.log, ev)
}

func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.POST("/login", h.login)
	rg.POST("/register", h.register)
	rg.POST("/send-code", h.sendCode)
	rg.POST("/forgot", h.forgot)
	rg.POST("/logout", middleware.Auth(h.cfg, h.s, middleware.AuthOpt{}), h.logout)
	rg.POST("/github/start", h.githubStart)
	rg.POST("/github/callback", h.githubCallback)
}

type loginReq struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6,max=64"`
}

func (h *Handler) login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("邮箱或密码格式不正确"))
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	var u store.User
	if err := h.s.DB.Where("email = ?", email).First(&u).Error; err != nil {
		response.Fail(c, errkit.BadRequest("邮箱或密码错误"))
		return
	}
	if u.Status == "banned" {
		response.Fail(c, errkit.Unauthorized("账号已被封禁"))
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
		response.Fail(c, errkit.BadRequest("邮箱或密码错误"))
		return
	}

	token, _, _, err := middleware.IssueJWT(h.cfg, u.ID, u.Role)
	if err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	audit.Emit(h.s.DB, h.log, audit.Event{
		ActorID: u.ID,
		Action:  "auth.login",
		Target:  fmt.Sprintf("user:%d", u.ID),
		Detail:  gin.H{"email": u.Email},
		IP:      c.ClientIP(),
	})
	response.OK(c, gin.H{"token": token, "user": u})
}

type registerReq struct {
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required,min=6,max=64"`
	Username   string `json:"username"`
	InviteCode string `json:"inviteCode"`
	EmailCode  string `json:"emailCode"`
}

func (h *Handler) register(c *gin.Context) {
	if !store.SettingBool(h.s.DB, "register.enabled", h.cfg.RegisterEnabled) {
		response.Fail(c, errkit.New(403, "registration_closed", "当前未开放注册"))
		return
	}
	var req registerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("注册参数有误"))
		return
	}
	if _, err := mail.ParseAddress(req.Email); err != nil {
		response.Fail(c, errkit.BadRequest("邮箱格式不正确"))
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	whitelist := normalizeEmailSuffixWhitelist(
		store.SettingStringSlice(h.s.DB, "register.emailSuffixWhitelist", nil),
	)
	if !isEmailSuffixAllowed(email, whitelist) {
		response.Fail(c, errkit.New(403, "email_domain_not_allowed", "邮箱域名不在允许列表内"))
		return
	}

	if store.SettingBool(h.s.DB, "register.requireEmail", h.cfg.RegisterEmailCodeRequired) {
		if !h.verifyEmailCode(c, email, "register", req.EmailCode) {
			return
		}
	}

	var inviter *store.User
	if h.cfg.RegisterInviteRequired || strings.TrimSpace(req.InviteCode) != "" {
		if strings.TrimSpace(req.InviteCode) == "" {
			response.Fail(c, errkit.BadRequest("邀请码必填"))
			return
		}
		var u store.User
		if err := h.s.DB.Where("invite_code = ?", strings.TrimSpace(req.InviteCode)).First(&u).Error; err != nil {
			response.Fail(c, errkit.BadRequest("邀请码无效"))
			return
		}
		inviter = &u
	}

	var existing int64
	h.s.DB.Model(&store.User{}).Where("email = ?", email).Count(&existing)
	if existing > 0 {
		response.Fail(c, errkit.Conflict("邮箱已注册"))
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	username := strings.TrimSpace(req.Username)
	if username == "" {
		username = strings.SplitN(email, "@", 2)[0]
	}
	u := store.User{
		Email:        email,
		PasswordHash: string(hash),
		Username:     username,
		Role:         "user",
		Status:       "active",
		GroupID:      1,
		InviteCode:   idgen.RandomAlpha(8),
	}
	if inviter != nil {
		u.InvitedBy = &inviter.ID
	}
	if err := h.s.DB.Create(&u).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}

	// 注册一次性奖励：邀请人 / 被邀请人各自加额度
	if inviter != nil {
		h.applySignupBonuses(c, inviter, &u)
	}

	token, _, _, err := middleware.IssueJWT(h.cfg, u.ID, u.Role)
	if err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	audit.Emit(h.s.DB, h.log, audit.Event{
		ActorID: u.ID,
		Action:  "auth.register",
		Target:  fmt.Sprintf("user:%d", u.ID),
		Detail:  gin.H{"email": u.Email, "invitedBy": u.InvitedBy},
		IP:      c.ClientIP(),
	})
	response.OK(c, gin.H{"token": token, "user": u})
}

type sendCodeReq struct {
	Email   string `json:"email" binding:"required,email"`
	Purpose string `json:"purpose"` // register / forgot
}

func (h *Handler) sendCode(c *gin.Context) {
	var req sendCodeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("邮箱格式不正确"))
		return
	}
	purpose := req.Purpose
	if purpose == "" {
		purpose = "register"
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	// Email-domain whitelist only applies to brand-new registrations. Existing
	// users keep working even if their original domain is later removed.
	if purpose == "register" {
		whitelist := normalizeEmailSuffixWhitelist(
			store.SettingStringSlice(h.s.DB, "register.emailSuffixWhitelist", nil),
		)
		if !isEmailSuffixAllowed(email, whitelist) {
			response.Fail(c, errkit.New(403, "email_domain_not_allowed", "邮箱域名不在允许列表内"))
			return
		}
	}

	code := idgen.CodeFromEmail()

	if err := h.s.Redis.Set(c, codeKey(email, purpose), code, 10*time.Minute).Err(); err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}

	// Dispatch the email. Failures here don't poison the response — the code
	// is already in Redis with a 10 min TTL, so the user can simply hit the
	// resend button if delivery fails (e.g. Resend rate limit, transient
	// SMTP outage). We DO surface the error in logs so operators see why
	// codes are missing if a deeper outage is brewing.
	if h.cfg.MailEnabled() {
		subject := fmt.Sprintf("[GetToken] %s 验证码", purposeLabel(purpose))
		body := mailpkg.VerifyCodeBody("GetToken", code)
		if err := h.mailer.Send(c.Request.Context(), email, subject, body); err != nil {
			h.log.Warn("mail send failed (code still valid in redis)",
				zap.Error(err), zap.String("email", email), zap.String("purpose", purpose))
		}
	} else {
		// Local dev convenience: surface the code in server logs so devs can
		// register without a real ESP. Disabled in production (where
		// MailEnabled() should be true).
		h.log.Warn("mailer disabled; code printed for dev",
			zap.String("email", email), zap.String("purpose", purpose), zap.String("code", code))
	}

	if h.cfg.Env == "development" {
		response.OK(c, gin.H{"sent": true, "devCode": code})
		return
	}
	response.OK(c, gin.H{"sent": true})
}

func purposeLabel(p string) string {
	switch p {
	case "forgot":
		return "密码重置"
	default:
		return "注册"
	}
}

type forgotReq struct {
	Email       string `json:"email" binding:"required,email"`
	EmailCode   string `json:"emailCode" binding:"required"`
	NewPassword string `json:"newPassword" binding:"required,min=6,max=64"`
}

func (h *Handler) forgot(c *gin.Context) {
	var req forgotReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if !h.verifyEmailCode(c, email, "forgot", req.EmailCode) {
		return
	}
	var u store.User
	if err := h.s.DB.Where("email = ?", email).First(&u).Error; err != nil {
		response.Fail(c, errkit.NotFound("用户不存在"))
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	if err := h.s.DB.Model(&u).Update("password_hash", string(hash)).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	audit.Emit(h.s.DB, h.log, audit.Event{
		ActorID: u.ID,
		Action:  "auth.password.reset",
		Target:  fmt.Sprintf("user:%d", u.ID),
		Detail:  gin.H{"email": u.Email},
		IP:      c.ClientIP(),
	})
	response.OK(c, gin.H{"reset": true})
}

func (h *Handler) logout(c *gin.Context) {
	jti := middleware.CurrentJTI(c)
	currentUserID := uint64(0)
	if u := middleware.CurrentUser(c); u != nil {
		currentUserID = u.ID
	}
	if jti == "" {
		response.OK(c, gin.H{"ok": true})
		return
	}
	_ = middleware.RevokeJWT(c, h.s.Redis, jti, h.cfg.JWTTTL)
	h.emitAudit(c, "auth.logout", fmt.Sprintf("user:%d", currentUserID), nil)
	response.OK(c, gin.H{"ok": true})
}

func codeKey(email, purpose string) string { return "emailcode:" + purpose + ":" + email }

func (h *Handler) verifyEmailCode(c *gin.Context, email, purpose, code string) bool {
	if strings.TrimSpace(code) == "" {
		response.Fail(c, errkit.BadRequest("邮箱验证码必填"))
		return false
	}
	v, err := h.s.Redis.Get(c, codeKey(email, purpose)).Result()
	if err != nil {
		response.Fail(c, errkit.BadRequest("验证码已过期，请重新获取"))
		return false
	}
	if !hmac.Equal([]byte(v), []byte(code)) {
		response.Fail(c, errkit.BadRequest("验证码错误"))
		return false
	}
	_ = h.s.Redis.Del(c, codeKey(email, purpose)).Err()
	return true
}

// EnsureAdmin creates the initial admin account from env on an empty users table.
func EnsureAdmin(ctx context.Context, cfg *config.Config, s *store.Store, log *zap.Logger) error {
	if cfg.AdminEmail == "" || cfg.AdminPassword == "" {
		return nil
	}
	var count int64
	if err := s.DB.WithContext(ctx).Model(&store.User{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(cfg.AdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u := store.User{
		Email:        strings.ToLower(strings.TrimSpace(cfg.AdminEmail)),
		PasswordHash: string(hash),
		Username:     fallback(cfg.AdminUsername, "Admin"),
		Role:         "admin",
		Status:       "active",
		GroupID:      1,
		InviteCode:   "GETOKEN",
	}
	if err := s.DB.WithContext(ctx).Create(&u).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil
		}
		return err
	}
	log.Info("default admin created", zap.String("email", u.Email))
	return nil
}

func fallback(a, b string) string {
	if strings.TrimSpace(a) == "" {
		return b
	}
	return a
}

// HashAPIKey produces the deterministic hash stored in the tokens table.
// It is an HMAC keyed by JWT_SECRET so different deployments produce different hashes.
func HashAPIKey(secret, key string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(key))
	return hex.EncodeToString(mac.Sum(nil))
}

// applySignupBonuses 在事务中给邀请人 / 被邀请人发注册奖励额度，并写一条返利记录。
// 任一步骤出错会回滚整笔奖励，但不会让注册本身失败（已记录日志，调用方继续走主流程）。
func (h *Handler) applySignupBonuses(c *gin.Context, inviter, invitee *store.User) {
	signupBonus := store.SettingDecimal(h.s.DB, "invite.signupBonus", decimal.Zero)
	refereeBonus := store.SettingDecimal(h.s.DB, "invite.refereeBonus", decimal.Zero)
	if signupBonus.IsZero() && refereeBonus.IsZero() {
		return
	}
	err := h.s.DB.Transaction(func(tx *gorm.DB) error {
		if signupBonus.GreaterThan(decimal.Zero) {
			if err := tx.Model(&store.User{}).Where("id = ?", inviter.ID).
				UpdateColumn("quota", gorm.Expr("quota + ?", signupBonus)).Error; err != nil {
				return err
			}
			if err := tx.Create(&store.Referral{
				InviterID: inviter.ID, InviteeID: invitee.ID, RewardQuota: signupBonus,
			}).Error; err != nil {
				return err
			}
		}
		if refereeBonus.GreaterThan(decimal.Zero) {
			if err := tx.Model(&store.User{}).Where("id = ?", invitee.ID).
				UpdateColumn("quota", gorm.Expr("quota + ?", refereeBonus)).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		h.log.Warn("apply signup bonuses failed", zap.Error(err), zap.Uint64("inviterId", inviter.ID))
	}
}
