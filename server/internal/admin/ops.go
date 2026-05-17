package admin

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/shopspring/decimal"

	"github.com/puppet/getoken/server/internal/pkg/errkit"
	"github.com/puppet/getoken/server/internal/response"
	"github.com/puppet/getoken/server/internal/store"
)

type opsSnapshotResp struct {
	WindowSeconds            int             `json:"windowSeconds"`
	QPS                      decimal.Decimal `json:"qps"`
	TPS                      decimal.Decimal `json:"tps"`
	Requests                 int64           `json:"requests"`
	Tokens                   int64           `json:"tokens"`
	Errors                   int64           `json:"errors"`
	ErrorRate                decimal.Decimal `json:"errorRate"`
	OnlineAccounts           int64           `json:"onlineAccounts"`
	DegradedAccounts         int64           `json:"degradedAccounts"`
	OfflineAccounts          int64           `json:"offlineAccounts"`
	ActiveAccountConcurrency int             `json:"activeAccountConcurrency"`
	ActiveUserConcurrency    int             `json:"activeUserConcurrency"`
	UpdatedAt                time.Time       `json:"updatedAt"`
}

func (h *Handler) opsSnapshot(c *gin.Context) {
	window := parseOpsWindow(c.Query("window"), 300)
	since := time.Now().Add(-time.Duration(window) * time.Second)

	var totals struct {
		Requests int64 `gorm:"column:requests"`
		Tokens   int64 `gorm:"column:tokens"`
		Errors   int64 `gorm:"column:errors"`
	}
	h.s.DB.Model(&store.Log{}).
		Select(`COUNT(*) AS requests,
			COALESCE(SUM(prompt_tokens + completion_tokens + cached_tokens + cache_creation_tokens + reasoning_tokens),0) AS tokens,
			COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END),0) AS errors`).
		Where("type = ? AND created_at >= ?", "request", since).
		Scan(&totals)

	var statusRows []struct {
		Status string `gorm:"column:status"`
		Count  int64  `gorm:"column:count"`
	}
	h.s.DB.Model(&store.UpstreamAccount{}).
		Select("status, COUNT(*) AS count").
		Group("status").Scan(&statusRows)

	resp := opsSnapshotResp{
		WindowSeconds: window,
		Requests:      totals.Requests,
		Tokens:        totals.Tokens,
		Errors:        totals.Errors,
		QPS:           decimal.NewFromInt(totals.Requests).Div(decimal.NewFromInt(int64(window))).Round(4),
		TPS:           decimal.NewFromInt(totals.Tokens).Div(decimal.NewFromInt(int64(window))).Round(2),
		UpdatedAt:     time.Now(),
	}
	if totals.Requests > 0 {
		resp.ErrorRate = decimal.NewFromInt(totals.Errors).Div(decimal.NewFromInt(totals.Requests)).Mul(decimal.NewFromInt(100)).Round(2)
	}
	for _, row := range statusRows {
		switch row.Status {
		case "online":
			resp.OnlineAccounts = row.Count
		case "degraded", "cooling":
			resp.DegradedAccounts += row.Count
		default:
			resp.OfflineAccounts += row.Count
		}
	}
	resp.ActiveAccountConcurrency = h.activeAccountConcurrency(c.Request.Context())
	resp.ActiveUserConcurrency = h.activeUserConcurrency(c.Request.Context())
	response.OK(c, resp)
}

type opsAccountResp struct {
	ID                 uint64     `json:"id"`
	UpstreamID         uint64     `json:"upstreamId"`
	UpstreamName       string     `json:"upstreamName"`
	Name               string     `json:"name"`
	Status             string     `json:"status"`
	Priority           int        `json:"priority"`
	Weight             int        `json:"weight"`
	RPMLimit           int        `json:"rpmLimit"`
	TPMLimit           int        `json:"tpmLimit"`
	ConcurrencyLimit   int        `json:"concurrencyLimit"`
	CurrentConcurrency int        `json:"currentConcurrency"`
	LatencyMs          int        `json:"latencyMs"`
	LastUsedAt         *time.Time `json:"lastUsedAt,omitempty"`
	LastCheckAt        *time.Time `json:"lastCheckAt,omitempty"`
	LastError          string     `json:"lastError,omitempty"`
}

func (h *Handler) opsAccounts(c *gin.Context) {
	var accounts []store.UpstreamAccount
	if err := h.s.DB.Order("upstream_id ASC, priority DESC, weight DESC, id ASC").Find(&accounts).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	upstreamNames := map[uint64]string{}
	var upstreams []store.Upstream
	h.s.DB.Select("id", "name").Find(&upstreams)
	for _, upstream := range upstreams {
		upstreamNames[upstream.ID] = upstream.Name
	}

	out := make([]opsAccountResp, 0, len(accounts))
	for _, account := range accounts {
		out = append(out, opsAccountResp{
			ID:                 account.ID,
			UpstreamID:         account.UpstreamID,
			UpstreamName:       upstreamNames[account.UpstreamID],
			Name:               account.Name,
			Status:             account.Status,
			Priority:           account.Priority,
			Weight:             account.Weight,
			RPMLimit:           account.RPMLimit,
			TPMLimit:           account.TPMLimit,
			ConcurrencyLimit:   account.ConcurrencyLimit,
			CurrentConcurrency: currentAccountConcurrency(c.Request.Context(), h.s, account.ID),
			LatencyMs:          account.LatencyMs,
			LastUsedAt:         account.LastUsedAt,
			LastCheckAt:        account.LastCheckAt,
			LastError:          account.LastError,
		})
	}
	response.OK(c, out)
}

func (h *Handler) opsErrors(c *gin.Context) {
	limit := parseOpsWindow(c.Query("limit"), 20)
	if limit > 100 {
		limit = 100
	}
	var rows []store.Log
	if err := h.s.DB.Where("type = ? AND status = ?", "request", "error").
		Order("id DESC").Limit(limit).Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	response.OK(c, rows)
}

func parseOpsWindow(raw string, def int) int {
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return def
	}
	if n > 3600 {
		return 3600
	}
	return n
}

func (h *Handler) activeAccountConcurrency(ctx context.Context) int {
	var accounts []store.UpstreamAccount
	h.s.DB.Select("id").Find(&accounts)
	total := 0
	for _, account := range accounts {
		total += currentAccountConcurrency(ctx, h.s, account.ID)
	}
	return total
}

func (h *Handler) activeUserConcurrency(ctx context.Context) int {
	var users []store.User
	h.s.DB.Select("id").Where("concurrency_limit > 0").Find(&users)
	total := 0
	for _, user := range users {
		total += currentUserConcurrency(ctx, h.s, user.ID)
	}
	return total
}

func currentAccountConcurrency(ctx context.Context, s *store.Store, accountID uint64) int {
	if s == nil || s.Redis == nil || accountID == 0 {
		return 0
	}
	n, err := s.Redis.Get(ctx, adminAccountConcurrencyKey(accountID)).Int()
	if err == redis.Nil || err != nil || n < 0 {
		return 0
	}
	return n
}

func currentUserConcurrency(ctx context.Context, s *store.Store, userID uint64) int {
	if s == nil || s.Redis == nil || userID == 0 {
		return 0
	}
	n, err := s.Redis.Get(ctx, adminUserConcurrencyKey(userID)).Int()
	if err == redis.Nil || err != nil || n < 0 {
		return 0
	}
	return n
}

func adminAccountConcurrencyKey(id uint64) string {
	return "relay:upstream-account:" + strconv.FormatUint(id, 10) + ":concurrency"
}

func adminUserConcurrencyKey(id uint64) string {
	return "relay:user:" + strconv.FormatUint(id, 10) + ":concurrency"
}
