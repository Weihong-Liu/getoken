package relay

import (
	"errors"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/puppet/getoken/server/internal/auth"
	"github.com/puppet/getoken/server/internal/config"
	"github.com/puppet/getoken/server/internal/store"
)

const tokenPrefix = "sk-getoken-"

// TokenAuth 校验 sk-getoken-* 形式的 API key，把 token / user 注入 ctx。
func TokenAuth(cfg *config.Config, s *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := extractAPIKey(c)
		if key == "" {
			writeRelayError(c, http.StatusUnauthorized, "invalid_request_error",
				"missing_api_key", "missing API key; expected Authorization: Bearer sk-getoken-... or x-api-key header")
			return
		}
		if !strings.HasPrefix(key, tokenPrefix) {
			writeRelayError(c, http.StatusUnauthorized, "invalid_request_error",
				"invalid_api_key", "API key prefix must be sk-getoken-")
			return
		}
		hash := auth.HashAPIKey(cfg.JWTSecret, key)

		var tok store.Token
		if err := s.DB.Where("key_hash = ?", hash).First(&tok).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				writeRelayError(c, http.StatusUnauthorized, "invalid_request_error",
					"invalid_api_key", "API key not recognised")
				return
			}
			writeRelayError(c, http.StatusInternalServerError, "api_error", "store_error", "token lookup failed")
			return
		}
		if tok.Status != 1 {
			writeRelayError(c, http.StatusForbidden, "invalid_request_error",
				"token_disabled", "API key has been disabled")
			return
		}
		if tok.ExpiredAt != nil && tok.ExpiredAt.Before(time.Now()) {
			writeRelayError(c, http.StatusForbidden, "invalid_request_error",
				"token_expired", "API key has expired")
			return
		}
		if !checkIPWhitelist(tok.IPWhitelist, c.ClientIP()) {
			writeRelayError(c, http.StatusForbidden, "invalid_request_error",
				"ip_not_allowed", "client IP is not in token whitelist")
			return
		}

		var usr store.User
		if err := s.DB.First(&usr, tok.UserID).Error; err != nil {
			writeRelayError(c, http.StatusUnauthorized, "invalid_request_error",
				"user_missing", "associated user not found")
			return
		}
		if usr.Status == "banned" {
			writeRelayError(c, http.StatusForbidden, "invalid_request_error",
				"user_banned", "account has been banned")
			return
		}

		c.Set(ctxToken, &tok)
		c.Set(ctxUser, &usr)
		c.Next()
	}
}

// extractAPIKey 同时支持 OpenAI 风格 (Authorization: Bearer …) 与
// Anthropic 风格 (x-api-key: …)。
func extractAPIKey(c *gin.Context) string {
	if v := strings.TrimSpace(c.Query("key")); v != "" {
		return v
	}
	if v := strings.TrimSpace(c.GetHeader("x-api-key")); v != "" {
		return v
	}
	if v := strings.TrimSpace(c.GetHeader("Authorization")); v != "" {
		if strings.HasPrefix(v, "Bearer ") {
			return strings.TrimSpace(strings.TrimPrefix(v, "Bearer "))
		}
		return v
	}
	return ""
}

// checkIPWhitelist：whitelist 空 → 全通；否则按行 / 逗号拆分，支持 CIDR 或单 IP。
func checkIPWhitelist(whitelist, clientIP string) bool {
	whitelist = strings.TrimSpace(whitelist)
	if whitelist == "" {
		return true
	}
	ip := net.ParseIP(clientIP)
	if ip == nil {
		return false
	}
	// split by newline / comma / space
	splitter := func(r rune) bool { return r == '\n' || r == ',' || r == ' ' || r == '\t' || r == ';' }
	for _, raw := range strings.FieldsFunc(whitelist, splitter) {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		if strings.Contains(raw, "/") {
			_, cidr, err := net.ParseCIDR(raw)
			if err == nil && cidr.Contains(ip) {
				return true
			}
			continue
		}
		if net.ParseIP(raw).Equal(ip) {
			return true
		}
	}
	return false
}

func tokenFromCtx(c *gin.Context) *store.Token {
	if v, ok := c.Get(ctxToken); ok {
		if t, ok := v.(*store.Token); ok {
			return t
		}
	}
	return nil
}

func userFromCtx(c *gin.Context) *store.User {
	if v, ok := c.Get(ctxUser); ok {
		if u, ok := v.(*store.User); ok {
			return u
		}
	}
	return nil
}

func startedAtFromCtx(c *gin.Context) time.Time {
	if v, ok := c.Get(ctxStartedAt); ok {
		if t, ok := v.(time.Time); ok {
			return t
		}
	}
	return time.Now()
}

// writeRelayError 返回 OpenAI 兼容的错误结构。
func writeRelayError(c *gin.Context, status int, errType, code, msg string) {
	c.AbortWithStatusJSON(status, gin.H{
		"error": gin.H{
			"message": msg,
			"type":    errType,
			"code":    code,
		},
	})
}

// relayErr 用于在 helper 函数之间传递结构化错误。
type relayErr struct {
	HTTP    int
	Type    string
	Code    string
	Message string
}

func (e *relayErr) Error() string { return e.Message }

func newRelayErr(http int, t, code, msg string) *relayErr {
	return &relayErr{HTTP: http, Type: t, Code: code, Message: msg}
}

func writeRelayAppError(c *gin.Context, err error) {
	var re *relayErr
	if errors.As(err, &re) {
		writeRelayError(c, re.HTTP, re.Type, re.Code, re.Message)
		return
	}
	writeRelayError(c, http.StatusInternalServerError, "api_error", "internal", err.Error())
}
