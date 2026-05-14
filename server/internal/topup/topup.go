package topup

import (
	"errors"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"

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

func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.POST("/redeem", h.redeem)
}

type redeemReq struct {
	Code string `json:"code" binding:"required"`
}

func (h *Handler) redeem(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var req redeemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("卡密格式不正确"))
		return
	}
	code := strings.TrimSpace(req.Code)
	if code == "" {
		response.Fail(c, errkit.BadRequest("卡密不能为空"))
		return
	}

	var amount decimal.Decimal
	err := h.s.DB.Transaction(func(tx *gorm.DB) error {
		var rc store.RedemptionCode
		if err := tx.Where("code = ?", code).First(&rc).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errkit.BadRequest("卡密不存在")
			}
			return err
		}
		if rc.Status == "used" {
			return errkit.BadRequest("卡密已被使用")
		}
		now := time.Now()
		amount = rc.Amount
		if err := tx.Model(&rc).Updates(map[string]any{
			"status":  "used",
			"used_by": u.ID,
			"used_at": now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&store.User{}).Where("id = ?", u.ID).
			UpdateColumn("quota", gorm.Expr("quota + ?", amount)).Error; err != nil {
			return err
		}
		// 兑换事件写审计日志（不再污染 logs 表，也不再产生返利——返利只来自真实消费）
		audit.Emit(tx, h.log, audit.Event{
			ActorID:      u.ID,
			TargetUserID: &u.ID,
			Action:       "topup.redeem",
			Target:       code,
			Amount:       amount,
			Detail:       map[string]any{"code": code},
			IP:           c.ClientIP(),
		})
		return nil
	})
	if err != nil {
		response.Fail(c, err)
		return
	}
	// refresh user
	h.s.DB.First(u, u.ID)
	response.OK(c, gin.H{"amount": amount, "balance": u.Quota.Sub(u.UsedQuota)})
}
