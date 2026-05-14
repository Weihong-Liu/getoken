package user

import (
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"github.com/puppet/getoken/server/internal/audit"
	"github.com/puppet/getoken/server/internal/middleware"
	"github.com/puppet/getoken/server/internal/pkg/errkit"
	"github.com/puppet/getoken/server/internal/response"
	"github.com/puppet/getoken/server/internal/store"
)

type Handler struct {
	s   *store.Store
	log *zap.Logger
}

func NewHandler(s *store.Store, log *zap.Logger) *Handler { return &Handler{s: s, log: log} }

func (h *Handler) emitAudit(c *gin.Context, action, target string, detail any) {
	ev := audit.Event{Action: action, Target: target, Detail: detail, IP: c.ClientIP()}
	if u := middleware.CurrentUser(c); u != nil {
		ev.ActorID = u.ID
	}
	audit.Emit(h.s.DB, h.log, ev)
}

func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/self", h.self)
	rg.PUT("/self", h.updateSelf)
	rg.PUT("/password", h.changePassword)
	rg.GET("/referrals", h.referrals)
}

func (h *Handler) self(c *gin.Context) {
	u := middleware.CurrentUser(c)
	response.OK(c, u)
}

type updateSelfReq struct {
	Username string `json:"username"`
}

func (h *Handler) updateSelf(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var req updateSelfReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	name := strings.TrimSpace(req.Username)
	if name != "" && name != u.Username {
		if err := h.s.DB.Model(u).Update("username", name).Error; err != nil {
			response.Fail(c, errkit.ErrInternal)
			return
		}
		u.Username = name
	}
	response.OK(c, u)
}

type changePasswordReq struct {
	Old string `json:"old" binding:"required"`
	New string `json:"new" binding:"required,min=6,max=64"`
}

func (h *Handler) changePassword(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var req changePasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Old)); err != nil {
		response.Fail(c, errkit.BadRequest("原密码不正确"))
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.New), bcrypt.DefaultCost)
	if err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	if err := h.s.DB.Model(u).Update("password_hash", string(hash)).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.emitAudit(c, "user.password.change", fmt.Sprintf("user:%d", u.ID), nil)
	response.OK(c, gin.H{"ok": true})
}

type referralItem struct {
	ID         uint64          `json:"id"`
	Email      string          `json:"email"`
	JoinedAt   time.Time       `json:"joinedAt"`
	TotalSpend decimal.Decimal `json:"totalSpend"`
	Reward     decimal.Decimal `json:"reward"`
}

func (h *Handler) referrals(c *gin.Context) {
	u := middleware.CurrentUser(c)

	items := []referralItem{}
	rows, err := h.s.DB.Raw(`
SELECT u.id, u.email, u.created_at AS joined_at,
  COALESCE((SELECT SUM(quota) FROM logs WHERE user_id = u.id), 0) AS total_spend,
  COALESCE((SELECT SUM(reward_quota) FROM referrals WHERE inviter_id = ? AND invitee_id = u.id), 0) AS reward
FROM users u WHERE u.invited_by = ?
ORDER BY u.created_at DESC LIMIT 200`, u.ID, u.ID).Rows()
	if err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var it referralItem
		if err := rows.Scan(&it.ID, &it.Email, &it.JoinedAt, &it.TotalSpend, &it.Reward); err != nil {
			response.Fail(c, errkit.ErrInternal)
			return
		}
		items = append(items, it)
	}

	totalReward := decimal.Zero
	for _, it := range items {
		totalReward = totalReward.Add(it.Reward)
	}

	var monthInvitees int64
	h.s.DB.Model(&store.User{}).
		Where("invited_by = ? AND created_at >= date_trunc('month', now())", u.ID).
		Count(&monthInvitees)

	response.OK(c, gin.H{
		"inviteCode": u.InviteCode,
		"stats": gin.H{
			"invitees":      len(items),
			"totalReward":   totalReward,
			"monthInvitees": monthInvitees,
		},
		"items": items,
	})
}
