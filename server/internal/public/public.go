package public

import (
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"

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
	rg.GET("/models", h.listModels)
	rg.GET("/status", h.status)
	rg.GET("/announcements", h.listAnnouncements)
}

type publicModel struct {
	ID                 string          `json:"id"`
	Vendor             string          `json:"vendor"`
	Context            int             `json:"context"`
	InputPrice         decimal.Decimal `json:"inputPrice"`         // USD per 1M input tokens
	OutputPrice        decimal.Decimal `json:"outputPrice"`        // USD per 1M output tokens
	CachedPrice        decimal.Decimal `json:"cachedPrice"`        // USD per 1M cache-hit tokens
	CacheCreationPrice decimal.Decimal `json:"cacheCreationPrice"` // USD per 1M cache-write tokens
	Status             string          `json:"status"`
	AllowedGroups      []string        `json:"allowedGroups"`
}

func (h *Handler) listModels(c *gin.Context) {
	var rows []store.ModelMapping
	if err := h.s.DB.Where("status = ?", "online").
		Order("vendor ASC, model_id ASC").Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	out := make([]publicModel, 0, len(rows))
	for _, r := range rows {
		groups := []string{}
		for _, g := range strings.Split(r.AllowedGroups, ",") {
			g = strings.TrimSpace(g)
			if g != "" {
				groups = append(groups, g)
			}
		}
		out = append(out, publicModel{
			ID:                 r.ModelID,
			Vendor:             r.Vendor,
			Context:            r.Context,
			InputPrice:         r.InputPrice,
			OutputPrice:        r.OutputPrice,
			CachedPrice:        r.CachedPrice,
			CacheCreationPrice: r.CacheCreationPrice,
			Status:             r.Status,
			AllowedGroups:      groups,
		})
	}
	response.OK(c, out)
}

type publicUpstream struct {
	ID          uint64     `json:"id"`
	Name        string     `json:"name"`
	Type        string     `json:"type"`
	Status      string     `json:"status"`
	LatencyMs   int        `json:"latencyMs"`
	LastCheckAt *time.Time `json:"lastCheckAt,omitempty"`
}

func (h *Handler) status(c *gin.Context) {
	var rows []store.Upstream
	if err := h.s.DB.Order("id ASC").Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	out := make([]publicUpstream, 0, len(rows))
	var updatedAt time.Time
	for _, r := range rows {
		out = append(out, publicUpstream{
			ID:          r.ID,
			Name:        r.Name,
			Type:        r.Type,
			Status:      r.Status,
			LatencyMs:   r.LatencyMs,
			LastCheckAt: r.LastCheckAt,
		})
		if r.LastCheckAt != nil && r.LastCheckAt.After(updatedAt) {
			updatedAt = *r.LastCheckAt
		}
	}
	if updatedAt.IsZero() {
		updatedAt = time.Now()
	}
	response.OK(c, gin.H{
		"upstreams": out,
		"updatedAt": updatedAt,
	})
}

type publicAnnouncement struct {
	ID        uint64    `json:"id"`
	Title     string    `json:"title"`
	Level     string    `json:"level"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

func (h *Handler) listAnnouncements(c *gin.Context) {
	var rows []store.Announcement
	if err := h.s.DB.Where("status = ?", "published").
		Order("id DESC").Limit(20).Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	out := make([]publicAnnouncement, 0, len(rows))
	for _, r := range rows {
		out = append(out, publicAnnouncement{
			ID:        r.ID,
			Title:     r.Title,
			Level:     r.Level,
			Content:   r.Content,
			CreatedAt: r.CreatedAt,
		})
	}
	response.OK(c, out)
}
