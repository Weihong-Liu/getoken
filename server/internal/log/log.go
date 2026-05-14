package log

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/puppet/getoken/server/internal/middleware"
	"github.com/puppet/getoken/server/internal/pkg/errkit"
	"github.com/puppet/getoken/server/internal/pkg/paginate"
	"github.com/puppet/getoken/server/internal/response"
	"github.com/puppet/getoken/server/internal/store"
)

type Handler struct {
	s   *store.Store
	log *zap.Logger
}

func NewHandler(s *store.Store, log *zap.Logger) *Handler { return &Handler{s: s, log: log} }

// RegisterUser exposes /log endpoints scoped to the current user.
func (h *Handler) RegisterUser(rg *gin.RouterGroup) {
	rg.GET("", h.listSelf)
	rg.GET("/export", h.exportSelf)
}

// RegisterAdmin exposes /admin/logs across all users.
func (h *Handler) RegisterAdmin(rg *gin.RouterGroup) {
	rg.GET("", h.listAll)
	rg.GET("/export", h.exportAll)
}

func (h *Handler) listSelf(c *gin.Context) {
	u := middleware.CurrentUser(c)
	h.list(c, "user_id = ?", u.ID)
}

func (h *Handler) listAll(c *gin.Context) {
	h.list(c, "1 = 1")
}

func (h *Handler) list(c *gin.Context, scope string, args ...any) {
	page := paginate.FromQuery(c)
	q := h.s.DB.Model(&store.Log{}).Where(scope, args...)
	q = applyFilters(c, q)

	var total int64
	q.Count(&total)

	var rows []store.Log
	if err := page.Apply(q).Order("id DESC").Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	response.OK(c, response.Page[store.Log]{
		Items: rows, Total: total, Page: page.Page, PageSize: page.PageSize,
	})
}

func (h *Handler) exportSelf(c *gin.Context) {
	u := middleware.CurrentUser(c)
	h.export(c, "user_id = ?", u.ID)
}

func (h *Handler) exportAll(c *gin.Context) {
	h.export(c, "1 = 1")
}

func (h *Handler) export(c *gin.Context, scope string, args ...any) {
	q := h.s.DB.Model(&store.Log{}).Where(scope, args...)
	q = applyFilters(c, q)

	var rows []store.Log
	if err := q.Order("id DESC").Limit(10000).Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}

	c.Writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
	c.Writer.Header().Set("Content-Disposition", `attachment; filename="logs.csv"`)
	c.Writer.WriteHeader(http.StatusOK)

	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{"id", "createdAt", "type", "model", "token", "prompt", "cached", "cacheCreation", "completion", "reasoningEffort", "reasoningTokens", "quota", "status", "latencyMs", "error"})
	for _, r := range rows {
		_ = w.Write([]string{
			strconv.FormatUint(r.ID, 10),
			r.CreatedAt.Format(time.RFC3339),
			r.Type, r.ModelName, r.TokenName,
			strconv.Itoa(r.PromptTokens),
			strconv.Itoa(r.CachedTokens),
			strconv.Itoa(r.CacheCreationTokens),
			strconv.Itoa(r.CompletionTokens),
			r.ReasoningEffort,
			strconv.Itoa(r.ReasoningTokens),
			r.Quota.String(), r.Status, strconv.Itoa(r.LatencyMs), r.Error,
		})
	}
	w.Flush()
}

func applyFilters(c *gin.Context, q *gorm.DB) *gorm.DB {
	// 默认只返回真实 API 调用日志；调用方显式传 ?type=all 时不过滤。
	switch v := c.Query("type"); v {
	case "":
		q = q.Where("type = ?", "request")
	case "all":
		// no-op
	default:
		q = q.Where("type = ?", v)
	}
	if v := c.Query("status"); v != "" {
		q = q.Where("status = ?", v)
	}
	if v := c.Query("model"); v != "" {
		q = q.Where("model_name = ?", v)
	}
	if v := c.Query("token"); v != "" {
		q = q.Where("token_name ILIKE ?", "%"+strings.ReplaceAll(v, "%", "")+"%")
	}
	if v := c.Query("startAt"); v != "" {
		if ts, err := time.Parse(time.RFC3339, v); err == nil {
			q = q.Where("created_at >= ?", ts)
		}
	}
	if v := c.Query("endAt"); v != "" {
		if ts, err := time.Parse(time.RFC3339, v); err == nil {
			q = q.Where("created_at <= ?", ts)
		}
	}
	return q
}

