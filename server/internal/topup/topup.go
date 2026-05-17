package topup

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/puppet/getoken/server/internal/audit"
	"github.com/puppet/getoken/server/internal/config"
	"github.com/puppet/getoken/server/internal/middleware"
	"github.com/puppet/getoken/server/internal/pkg/errkit"
	"github.com/puppet/getoken/server/internal/pkg/idgen"
	"github.com/puppet/getoken/server/internal/response"
	"github.com/puppet/getoken/server/internal/store"
)

type Handler struct {
	cfg *config.Config
	s   *store.Store
	log *zap.Logger
}

func NewHandler(cfg *config.Config, s *store.Store, log *zap.Logger) *Handler {
	return &Handler{cfg: cfg, s: s, log: log}
}

func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.POST("/redeem", h.redeem)
	rg.POST("/order", h.createOrder)
	rg.GET("/orders", h.listOrders)
	rg.POST("/orders/:id/cancel", h.cancelOrder)
	rg.POST("/orders/:id/simulate-paid", h.simulatePaid)
}

func (h *Handler) RegisterPublic(rg *gin.RouterGroup) {
	rg.POST("/alipay/notify", h.alipayNotify)
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

type createOrderReq struct {
	Amount  decimal.Decimal `json:"amount" binding:"required"`
	Channel string          `json:"channel" binding:"required"`
}

func (h *Handler) createOrder(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var req createOrderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	amount := req.Amount
	if amount.LessThan(decimal.NewFromInt(1)) {
		response.Fail(c, errkit.BadRequest("最低充值金额为 $1"))
		return
	}
	if amount.GreaterThan(decimal.NewFromInt(100000)) {
		response.Fail(c, errkit.BadRequest("单笔充值金额过大"))
		return
	}
	channel := normalizeChannel(req.Channel)
	if channel == "" {
		response.Fail(c, errkit.BadRequest("支付方式不支持"))
		return
	}
	if !h.paymentChannelEnabled(channel) {
		response.Fail(c, errkit.BadRequest("该支付方式未启用"))
		return
	}

	expires := time.Now().Add(30 * time.Minute)
	order := store.PaymentOrder{
		OrderNo:   "pay_" + time.Now().Format("20060102150405") + "_" + strings.ToLower(idgen.RandomAlpha(8)),
		UserID:    u.ID,
		Provider:  h.paymentProvider(channel),
		Channel:   channel,
		Amount:    amount.Round(2),
		Currency:  "USD",
		Status:    "PENDING",
		ExpiredAt: &expires,
	}
	pay, err := h.createAlipayPagePay(order)
	if err != nil {
		response.Fail(c, errkit.BadRequest(err.Error()))
		return
	}
	order.PayURL = pay.PayURL
	order.QRContent = fmt.Sprintf("ALIPAY:%s:%s", order.OrderNo, order.Amount.StringFixed(2))
	if err := h.s.DB.Create(&order).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	response.Created(c, gin.H{
		"order":     order,
		"payUrl":    order.PayURL,
		"qrContent": order.QRContent,
	})
}

func (h *Handler) listOrders(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var rows []store.PaymentOrder
	if err := h.s.DB.Where("user_id = ?", u.ID).Order("id DESC").Limit(50).Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	response.OK(c, rows)
}

func (h *Handler) cancelOrder(c *gin.Context) {
	u := middleware.CurrentUser(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var order store.PaymentOrder
	if err := h.s.DB.Where("id = ? AND user_id = ?", id, u.ID).First(&order).Error; err != nil {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	if order.Status != "PENDING" {
		response.Fail(c, errkit.BadRequest("只有待支付订单可以取消"))
		return
	}
	if err := h.s.DB.Model(&order).Update("status", "CANCELLED").Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *Handler) simulatePaid(c *gin.Context) {
	if h.cfg != nil && h.cfg.Env == "production" {
		response.Fail(c, errkit.BadRequest("生产环境不允许模拟支付"))
		return
	}
	u := middleware.CurrentUser(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var order store.PaymentOrder
	if err := h.s.DB.Where("id = ? AND user_id = ?", id, u.ID).First(&order).Error; err != nil {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	if err := h.completeOrder(c, &order, "simulated"); err != nil {
		response.Fail(c, err)
		return
	}
	h.s.DB.First(&order, order.ID)
	response.OK(c, order)
}

func (h *Handler) completeOrder(c *gin.Context, order *store.PaymentOrder, providerRef string) error {
	clientIP := ""
	if c != nil {
		clientIP = c.ClientIP()
	}
	return h.completeOrderWithIP(order, providerRef, clientIP)
}

func (h *Handler) completeOrderWithIP(order *store.PaymentOrder, providerRef, clientIP string) error {
	if order.Status != "PENDING" && order.Status != "PAID" {
		if order.Status == "COMPLETED" {
			return nil
		}
		return errkit.BadRequest("订单状态不能完成")
	}
	now := time.Now()
	return h.s.DB.Transaction(func(tx *gorm.DB) error {
		var locked store.PaymentOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&locked, order.ID).Error; err != nil {
			return err
		}
		if locked.Status == "COMPLETED" {
			return nil
		}
		if locked.Status != "PENDING" && locked.Status != "PAID" {
			return errkit.BadRequest("订单状态不能完成")
		}
		if err := tx.Model(&locked).Updates(map[string]any{
			"status":       "COMPLETED",
			"paid_at":      now,
			"completed_at": now,
			"provider_ref": providerRef,
		}).Error; err != nil {
			return err
		}
		locked.Status = "COMPLETED"
		locked.PaidAt = &now
		locked.CompletedAt = &now
		locked.ProviderRef = providerRef
		if err := tx.Model(&store.User{}).Where("id = ?", locked.UserID).
			UpdateColumn("quota", gorm.Expr("quota + ?", locked.Amount)).Error; err != nil {
			return err
		}
		*order = locked
		audit.Emit(tx, h.log, audit.Event{
			ActorID:      locked.UserID,
			TargetUserID: &locked.UserID,
			Action:       "topup.order.completed",
			Target:       locked.OrderNo,
			Amount:       locked.Amount,
			Detail:       map[string]any{"channel": locked.Channel, "provider": locked.Provider, "providerRef": providerRef},
			IP:           clientIP,
		})
		return nil
	})
}

func (h *Handler) alipayNotify(c *gin.Context) {
	if err := c.Request.ParseForm(); err != nil {
		c.String(200, "failure")
		return
	}
	cfg := h.loadAlipayConfig()
	if !verifyAlipayNotify(c.Request.PostForm, cfg.PublicKey) {
		c.String(200, "failure")
		return
	}
	if cfg.AppID != "" && c.PostForm("app_id") != "" && c.PostForm("app_id") != cfg.AppID {
		c.String(200, "failure")
		return
	}
	orderNo := c.PostForm("out_trade_no")
	if orderNo == "" {
		c.String(200, "failure")
		return
	}
	var order store.PaymentOrder
	if err := h.s.DB.Where("order_no = ?", orderNo).First(&order).Error; err != nil {
		c.String(200, "failure")
		return
	}
	if !decimalEqualsMoney(order.Amount, c.PostForm("total_amount")) {
		c.String(200, "failure")
		return
	}
	status := c.PostForm("trade_status")
	switch status {
	case "TRADE_SUCCESS", "TRADE_FINISHED":
		if err := h.completeOrderWithIP(&order, c.PostForm("trade_no"), c.ClientIP()); err != nil {
			c.String(200, "failure")
			return
		}
		c.String(200, "success")
	case "TRADE_CLOSED":
		_ = h.s.DB.Model(&order).Update("status", "CANCELLED").Error
		c.String(200, "success")
	default:
		c.String(200, "success")
	}
}

func normalizeChannel(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "alipay":
		return strings.ToLower(strings.TrimSpace(raw))
	default:
		return ""
	}
}

func (h *Handler) paymentChannelEnabled(channel string) bool {
	if h.cfg != nil && h.cfg.Env == "development" {
		return true
	}
	var setting store.Setting
	key := "payment." + channel + ".enabled"
	if err := h.s.DB.Where("key = ?", key).First(&setting).Error; err != nil {
		return false
	}
	return strings.Contains(strings.ToLower(setting.Value), "true")
}

func (h *Handler) paymentProvider(channel string) string {
	var setting store.Setting
	key := "payment." + channel + ".provider"
	if err := h.s.DB.Where("key = ?", key).First(&setting).Error; err == nil {
		return strings.Trim(setting.Value, `"`)
	}
	if channel == "alipay" {
		return "alipay"
	}
	return "manual"
}
