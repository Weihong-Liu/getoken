package relay

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"github.com/puppet/getoken/server/internal/store"
)

type relayUsageBucket struct {
	D                   time.Time       `gorm:"column:d"`
	Requests            int64           `gorm:"column:requests"`
	PromptTokens        int64           `gorm:"column:prompt_tokens"`
	CompletionTokens    int64           `gorm:"column:completion_tokens"`
	CachedTokens        int64           `gorm:"column:cached_tokens"`
	CacheCreationTokens int64           `gorm:"column:cache_creation_tokens"`
	ReasoningTokens     int64           `gorm:"column:reasoning_tokens"`
	Cost                decimal.Decimal `gorm:"column:cost"`
}

type relayModelUsage struct {
	ModelName string          `gorm:"column:model_name" json:"model"`
	Requests  int64           `gorm:"column:requests" json:"requests"`
	Tokens    int64           `gorm:"column:tokens" json:"tokens"`
	Cost      decimal.Decimal `gorm:"column:cost" json:"cost"`
}

func (h *Handler) usageSummary(c *gin.Context) {
	usr := userFromCtx(c)
	if usr == nil {
		writeRelayError(c, http.StatusUnauthorized, "invalid_request_error", "missing_token", "missing token context")
		return
	}

	days := parseUsageWindow(c.Query("range"), c.Query("days"))
	since := usageStartOfDay(time.Now().AddDate(0, 0, -(days - 1)))

	tokenID := strings.TrimSpace(c.Query("token_id"))
	usageQuery := func() *gorm.DB {
		q := h.s.DB.Model(&store.Log{}).
			Where("user_id = ? AND type = ? AND created_at >= ?", usr.ID, "request", since)
		if tokenID != "" {
			q = q.Where("token_id = ?", tokenID)
		}
		return q
	}

	var total relayUsageBucket
	usageQuery().Select(`COUNT(*) AS requests,
		COALESCE(SUM(prompt_tokens),0) AS prompt_tokens,
		COALESCE(SUM(completion_tokens),0) AS completion_tokens,
		COALESCE(SUM(cached_tokens),0) AS cached_tokens,
		COALESCE(SUM(cache_creation_tokens),0) AS cache_creation_tokens,
		COALESCE(SUM(reasoning_tokens),0) AS reasoning_tokens,
		COALESCE(SUM(quota),0) AS cost`).Scan(&total)

	var buckets []relayUsageBucket
	usageQuery().Select(`date_trunc('day', created_at) AS d,
		COUNT(*) AS requests,
		COALESCE(SUM(prompt_tokens),0) AS prompt_tokens,
		COALESCE(SUM(completion_tokens),0) AS completion_tokens,
		COALESCE(SUM(cached_tokens),0) AS cached_tokens,
		COALESCE(SUM(cache_creation_tokens),0) AS cache_creation_tokens,
		COALESCE(SUM(reasoning_tokens),0) AS reasoning_tokens,
		COALESCE(SUM(quota),0) AS cost`).
		Group("d").Order("d").Scan(&buckets)

	var models []relayModelUsage
	usageQuery().Select(`model_name,
		COUNT(*) AS requests,
		COALESCE(SUM(prompt_tokens + completion_tokens + cached_tokens + cache_creation_tokens + reasoning_tokens),0) AS tokens,
		COALESCE(SUM(quota),0) AS cost`).
		Where("model_name <> ''").
		Group("model_name").Order("requests DESC").Limit(20).Scan(&models)

	c.JSON(http.StatusOK, gin.H{
		"object":     "usage.summary",
		"range_days": days,
		"total":      usageBucketPayload(total, ""),
		"data":       fillUsageBuckets(buckets, since, days),
		"models":     models,
	})
}

func parseUsageWindow(values ...string) int {
	for _, value := range values {
		value = strings.TrimSpace(strings.TrimSuffix(value, "d"))
		if value == "" {
			continue
		}
		n, err := strconv.Atoi(value)
		if err == nil && n > 0 && n <= 90 {
			return n
		}
	}
	return 30
}

func fillUsageBuckets(rows []relayUsageBucket, since time.Time, days int) []gin.H {
	index := map[string]relayUsageBucket{}
	for _, row := range rows {
		index[row.D.Format("2006-01-02")] = row
	}
	out := make([]gin.H, 0, days)
	for i := 0; i < days; i++ {
		d := since.AddDate(0, 0, i)
		key := d.Format("2006-01-02")
		out = append(out, usageBucketPayload(index[key], d.Format("2006-01-02")))
	}
	return out
}

func usageBucketPayload(row relayUsageBucket, date string) gin.H {
	input := row.PromptTokens + row.CachedTokens + row.CacheCreationTokens
	output := row.CompletionTokens
	total := input + output + row.ReasoningTokens
	return gin.H{
		"date":                  date,
		"requests":              row.Requests,
		"input_tokens":          input,
		"output_tokens":         output,
		"cached_tokens":         row.CachedTokens,
		"cache_creation_tokens": row.CacheCreationTokens,
		"reasoning_tokens":      row.ReasoningTokens,
		"total_tokens":          total,
		"cost":                  row.Cost,
	}
}

func usageStartOfDay(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}
