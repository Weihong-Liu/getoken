package relay

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

func (h *Handler) accountBalance(c *gin.Context) {
	usr := userFromCtx(c)
	tok := tokenFromCtx(c)
	if usr == nil || tok == nil {
		writeRelayError(c, http.StatusUnauthorized, "invalid_request_error", "missing_token", "missing token context")
		return
	}

	remaining := usr.Quota.Sub(usr.UsedQuota)
	if remaining.IsNegative() {
		remaining = decimal.Zero
	}

	tokenRemaining := tok.RemainQuota
	if tok.UnlimitedQuota {
		tokenRemaining = remaining
	}
	if tokenRemaining.IsNegative() {
		tokenRemaining = decimal.Zero
	}

	c.JSON(http.StatusOK, gin.H{
		"object": "account.balance",
		"balance": gin.H{
			"quota":     usr.Quota,
			"used":      usr.UsedQuota,
			"remaining": remaining,
		},
		"token": gin.H{
			"id":              tok.ID,
			"name":            tok.Name,
			"key_prefix":      tok.KeyPrefix,
			"unlimited_quota": tok.UnlimitedQuota,
			"remaining_quota": tokenRemaining,
		},
	})
}
