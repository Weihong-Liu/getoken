package token

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/puppet/getoken/server/internal/auth"
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
	rg.GET("", h.list)
	rg.POST("", h.create)
	rg.PUT("/:id", h.update)
	rg.DELETE("/:id", h.delete)
}

type tokenView struct {
	store.Token
	Key string `json:"key,omitempty"` // populated on create only
}

func (h *Handler) list(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var rows []store.Token
	if err := h.s.DB.Where("user_id = ?", u.ID).Order("id DESC").Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	views := make([]tokenView, len(rows))
	for i, r := range rows {
		views[i] = tokenView{Token: r}
	}
	response.OK(c, views)
}

type createReq struct {
	Name           string `json:"name" binding:"required,max=64"`
	GroupID        uint64 `json:"groupId"`
	RemainQuota    string `json:"remainQuota"`
	UnlimitedQuota bool   `json:"unlimitedQuota"`
	ExpiredAt      int64  `json:"expiredAt"` // unix seconds; 0 = never
	IPWhitelist    string `json:"ipWhitelist"`
}

func (h *Handler) create(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var req createReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	quota := decimal.Zero
	if !req.UnlimitedQuota && req.RemainQuota != "" {
		q, err := decimal.NewFromString(req.RemainQuota)
		if err != nil || q.IsNegative() {
			response.Fail(c, errkit.BadRequest("额度格式不正确"))
			return
		}
		quota = q
	}
	key := idgen.APIKey()
	t := store.Token{
		UserID:         u.ID,
		Name:           req.Name,
		KeyHash:        auth.HashAPIKey(h.cfg.JWTSecret, key),
		KeyPrefix:      key[:14],
		Status:         1,
		RemainQuota:    quota,
		UnlimitedQuota: req.UnlimitedQuota,
		GroupID:        defaultGroup(req.GroupID, u.GroupID),
		IPWhitelist:    req.IPWhitelist,
	}
	if req.ExpiredAt > 0 {
		ts := time.Unix(req.ExpiredAt, 0)
		t.ExpiredAt = &ts
	}
	if err := h.s.DB.Create(&t).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	response.Created(c, tokenView{Token: t, Key: key})
}

type updateReq struct {
	Name           *string `json:"name"`
	Status         *int    `json:"status"`
	RemainQuota    *string `json:"remainQuota"`
	UnlimitedQuota *bool   `json:"unlimitedQuota"`
	ExpiredAt      *int64  `json:"expiredAt"`
	IPWhitelist    *string `json:"ipWhitelist"`
	GroupID        *uint64 `json:"groupId"`
}

func (h *Handler) update(c *gin.Context) {
	u := middleware.CurrentUser(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var t store.Token
	if err := h.s.DB.Where("id = ? AND user_id = ?", id, u.ID).First(&t).Error; err != nil {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	var req updateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	updates := map[string]any{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.UnlimitedQuota != nil {
		updates["unlimited_quota"] = *req.UnlimitedQuota
	}
	if req.RemainQuota != nil {
		q, err := decimal.NewFromString(*req.RemainQuota)
		if err != nil || q.IsNegative() {
			response.Fail(c, errkit.BadRequest("额度格式不正确"))
			return
		}
		updates["remain_quota"] = q
	}
	if req.ExpiredAt != nil {
		if *req.ExpiredAt > 0 {
			ts := time.Unix(*req.ExpiredAt, 0)
			updates["expired_at"] = ts
		} else {
			updates["expired_at"] = gorm.Expr("NULL")
		}
	}
	if req.IPWhitelist != nil {
		updates["ip_whitelist"] = *req.IPWhitelist
	}
	if req.GroupID != nil {
		updates["group_id"] = *req.GroupID
	}
	if len(updates) > 0 {
		if err := h.s.DB.Model(&t).Updates(updates).Error; err != nil {
			response.Fail(c, errkit.ErrInternal)
			return
		}
	}
	h.s.DB.First(&t, t.ID)
	response.OK(c, tokenView{Token: t})
}

func (h *Handler) delete(c *gin.Context) {
	u := middleware.CurrentUser(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	res := h.s.DB.Where("id = ? AND user_id = ?", id, u.ID).Delete(&store.Token{})
	if res.Error != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	if res.RowsAffected == 0 {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func defaultGroup(want, fallback uint64) uint64 {
	if want > 0 {
		return want
	}
	if fallback > 0 {
		return fallback
	}
	return 1
}
