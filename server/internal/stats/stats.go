package stats

import (
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/puppet/getoken/server/internal/middleware"
	"github.com/puppet/getoken/server/internal/response"
	"github.com/puppet/getoken/server/internal/store"
)

type Handler struct {
	s   *store.Store
	log *zap.Logger
}

func NewHandler(s *store.Store, log *zap.Logger) *Handler { return &Handler{s: s, log: log} }

func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("", h.userStats)
}

func (h *Handler) RegisterAdmin(rg *gin.RouterGroup) {
	rg.GET("", h.adminStats)
}

type seriesPoint struct {
	Date     string          `json:"date"`
	Requests int64           `json:"requests"`
	Tokens   int64           `json:"tokens"`
	Cost     decimal.Decimal `json:"cost"`
}

type topModel struct {
	Name     string `json:"name"`
	Requests int64  `json:"requests"`
	Tokens   int64  `json:"tokens"`
}

type userStatsResp struct {
	Balance       decimal.Decimal `json:"balance"`
	UsedToday     decimal.Decimal `json:"usedToday"`
	RequestsToday int64           `json:"requestsToday"`
	Series        []seriesPoint   `json:"series"`
	TopModels     []topModel      `json:"topModels"`
}

func (h *Handler) userStats(c *gin.Context) {
	u := middleware.CurrentUser(c)
	days := parseRangeDays(c.Query("range"), 14)
	resp := userStatsResp{
		Balance: u.Quota.Sub(u.UsedQuota),
	}

	since := startOfDay(time.Now().AddDate(0, 0, -(days - 1)))
	todayStart := startOfDay(time.Now())

	// today's usage（仅 type=request）
	row := h.s.DB.Model(&store.Log{}).
		Select("COALESCE(SUM(quota),0) AS quota, COUNT(*) AS reqs").
		Where("user_id = ? AND type = ? AND created_at >= ?", u.ID, "request", todayStart)
	var today struct {
		Quota decimal.Decimal
		Reqs  int64
	}
	row.Scan(&today)
	resp.UsedToday = today.Quota
	resp.RequestsToday = today.Reqs

	// series
	var buckets []dayBucket
	h.s.DB.Model(&store.Log{}).
		Select("date_trunc('day', created_at) AS d, COUNT(*) AS reqs, COALESCE(SUM(prompt_tokens + completion_tokens),0) AS tokens, COALESCE(SUM(quota),0) AS cost").
		Where("user_id = ? AND type = ? AND created_at >= ?", u.ID, "request", since).
		Group("d").Order("d").Scan(&buckets)

	resp.Series = fillSeries(buckets, since, days)

	// top models
	type tm struct {
		ModelName string `gorm:"column:model_name"`
		Reqs      int64  `gorm:"column:reqs"`
		Tokens    int64  `gorm:"column:tokens"`
	}
	var tms []tm
	h.s.DB.Model(&store.Log{}).
		Select("model_name, COUNT(*) AS reqs, COALESCE(SUM(prompt_tokens + completion_tokens),0) AS tokens").
		Where("user_id = ? AND type = ? AND created_at >= ? AND model_name <> ''", u.ID, "request", since).
		Group("model_name").Order("reqs DESC").Limit(5).Scan(&tms)

	resp.TopModels = make([]topModel, 0, len(tms))
	for _, t := range tms {
		resp.TopModels = append(resp.TopModels, topModel{Name: t.ModelName, Requests: t.Reqs, Tokens: t.Tokens})
	}
	response.OK(c, resp)
}

type adminStatsResp struct {
	Users         int64           `json:"users"`
	Tokens        int64           `json:"tokens"`
	RequestsToday int64           `json:"requestsToday"`
	RevenueToday  decimal.Decimal `json:"revenueToday"`
	Series        []seriesPoint   `json:"series"`
	TopModels     []topModel      `json:"topModels"`
}

func (h *Handler) adminStats(c *gin.Context) {
	days := parseRangeDays(c.Query("range"), 14)
	var resp adminStatsResp
	h.s.DB.Model(&store.User{}).Count(&resp.Users)
	h.s.DB.Model(&store.Token{}).Count(&resp.Tokens)

	todayStart := startOfDay(time.Now())
	var today struct {
		Reqs int64
	}
	h.s.DB.Model(&store.Log{}).
		Select("COUNT(*) AS reqs").
		Where("type = ? AND created_at >= ?", "request", todayStart).Scan(&today)
	resp.RequestsToday = today.Reqs

	// revenue 来源审计日志中的兑换事件
	var revenueToday decimal.Decimal
	h.s.DB.Model(&store.AuditLog{}).
		Select("COALESCE(SUM(amount),0)").
		Where("action IN ? AND created_at >= ?", []string{"topup.redeem", "topup.order.completed"}, todayStart).
		Scan(&revenueToday)
	resp.RevenueToday = revenueToday

	since := startOfDay(time.Now().AddDate(0, 0, -(days - 1)))
	var buckets []dayBucket
	h.s.DB.Model(&store.Log{}).
		Select("date_trunc('day', created_at) AS d, COUNT(*) AS reqs, COALESCE(SUM(prompt_tokens + completion_tokens),0) AS tokens, COALESCE(SUM(quota),0) AS cost").
		Where("type = ? AND created_at >= ?", "request", since).
		Group("d").Order("d").Scan(&buckets)
	resp.Series = fillSeries(buckets, since, days)

	type tm struct {
		ModelName string `gorm:"column:model_name"`
		Reqs      int64  `gorm:"column:reqs"`
		Tokens    int64  `gorm:"column:tokens"`
	}
	var tms []tm
	h.s.DB.Model(&store.Log{}).
		Select("model_name, COUNT(*) AS reqs, COALESCE(SUM(prompt_tokens + completion_tokens),0) AS tokens").
		Where("type = ? AND created_at >= ? AND model_name <> ''", "request", since).
		Group("model_name").Order("reqs DESC").Limit(5).Scan(&tms)
	resp.TopModels = make([]topModel, 0, len(tms))
	for _, t := range tms {
		resp.TopModels = append(resp.TopModels, topModel{Name: t.ModelName, Requests: t.Reqs, Tokens: t.Tokens})
	}
	response.OK(c, resp)
}

func parseRangeDays(s string, def int) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return def
	}
	s = strings.TrimSuffix(s, "d")
	n, err := strconv.Atoi(s)
	if err != nil || n <= 0 || n > 90 {
		return def
	}
	return n
}

func startOfDay(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}

type dayBucket struct {
	D      time.Time       `gorm:"column:d"`
	Reqs   int64           `gorm:"column:reqs"`
	Tokens int64           `gorm:"column:tokens"`
	Cost   decimal.Decimal `gorm:"column:cost"`
}

// fillSeries returns one bucket per day for the requested window, zero-filled.
func fillSeries(rows []dayBucket, since time.Time, days int) []seriesPoint {
	index := map[string]int{}
	for i, r := range rows {
		index[r.D.Format("2006-01-02")] = i
	}
	out := make([]seriesPoint, days)
	for i := 0; i < days; i++ {
		d := since.AddDate(0, 0, i)
		key := d.Format("2006-01-02")
		p := seriesPoint{Date: d.Format("01-02")}
		if idx, ok := index[key]; ok {
			p.Requests = rows[idx].Reqs
			p.Tokens = rows[idx].Tokens
			p.Cost = rows[idx].Cost
		}
		out[i] = p
	}
	return out
}
