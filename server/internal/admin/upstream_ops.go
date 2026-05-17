package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	"github.com/puppet/getoken/server/internal/billing"
	"github.com/puppet/getoken/server/internal/pkg/errkit"
	"github.com/puppet/getoken/server/internal/response"
	"github.com/puppet/getoken/server/internal/store"
)

type upstreamBulkStatusReq struct {
	IDs    []uint64 `json:"ids"`
	Status string   `json:"status"`
}

func (h *Handler) bulkUpdateUpstreams(c *gin.Context) {
	var req upstreamBulkStatusReq
	if err := c.ShouldBindJSON(&req); err != nil || len(req.IDs) == 0 {
		response.Fail(c, errkit.BadRequest("请选择要操作的上游"))
		return
	}
	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status != "online" && status != "degraded" && status != "offline" {
		response.Fail(c, errkit.BadRequest("状态不支持"))
		return
	}
	res := h.s.DB.Model(&store.Upstream{}).Where("id IN ?", req.IDs).Updates(map[string]any{
		"status": status,
	})
	if res.Error != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.emitAudit(c, "admin.upstream.bulk_status", "upstream", gin.H{"ids": req.IDs, "status": status, "affected": res.RowsAffected})
	response.OK(c, gin.H{"affected": res.RowsAffected})
}

func (h *Handler) checkUpstream(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var upstream store.Upstream
	if err := h.s.DB.First(&upstream, id).Error; err != nil {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	start := time.Now()
	models, err := h.fetchUpstreamModels(c.Request.Context(), upstream)
	latency := int(time.Since(start).Milliseconds())
	now := time.Now()
	updates := map[string]any{
		"latency_ms":    latency,
		"last_check_at": now,
	}
	if err != nil {
		updates["last_error"] = truncateText(err.Error(), 512)
		updates["failure_count"] = upstream.FailureCount + 1
		if upstream.AutoDisable && upstream.FailureThreshold > 0 && upstream.FailureCount+1 >= upstream.FailureThreshold {
			updates["status"] = "offline"
		} else {
			updates["status"] = "degraded"
		}
		_ = h.s.DB.Model(&upstream).Updates(updates).Error
		response.Fail(c, errkit.BadRequest("检测失败: "+err.Error()))
		return
	}
	updates["status"] = "online"
	updates["failure_count"] = 0
	updates["last_error"] = ""
	if err := h.s.DB.Model(&upstream).Updates(updates).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.emitAudit(c, "admin.upstream.check", fmt.Sprintf("upstream:%d", upstream.ID), gin.H{"latencyMs": latency, "models": len(models)})
	response.OK(c, gin.H{"ok": true, "latencyMs": latency, "models": len(models)})
}

type syncModelsReq struct {
	Overwrite     bool   `json:"overwrite"`
	UpdatePrices  bool   `json:"updatePrices"`
	AllowedGroups string `json:"allowedGroups"`
	Status        string `json:"status"`
}

func (h *Handler) syncUpstreamModels(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var upstream store.Upstream
	if err := h.s.DB.First(&upstream, id).Error; err != nil {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	var req syncModelsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	models, err := h.fetchUpstreamModels(c.Request.Context(), upstream)
	if err != nil {
		response.Fail(c, errkit.BadRequest("同步失败: "+err.Error()))
		return
	}
	status := orDefault(req.Status, "online")
	if status != "online" && status != "offline" {
		status = "online"
	}
	allowedGroups := strings.TrimSpace(req.AllowedGroups)
	if allowedGroups == "" {
		allowedGroups = "default"
	}

	var created, updated, skipped int
	for _, remote := range models {
		modelID := strings.TrimSpace(remote.ID)
		if modelID == "" {
			skipped++
			continue
		}
		def, hasDefault := defaultModelSnapshot(modelID)
		vendor := inferVendor(modelID, upstream.Type, remote.OwnedBy)
		contextWindow := remote.Context
		inputPrice, outputPrice, cachedPrice, cacheCreationPrice := decimal.NewFromInt(1), decimal.NewFromInt(1), decimal.Zero, decimal.Zero
		if hasDefault {
			vendor = def.Vendor
			contextWindow = def.Context
			inputPrice = mustDecimal(def.InputPrice, inputPrice)
			outputPrice = mustDecimal(def.OutputPrice, outputPrice)
			cachedPrice = mustDecimal(def.CachedPrice, decimal.Zero)
			cacheCreationPrice = mustDecimal(def.CacheCreationPrice, decimal.Zero)
		}
		if contextWindow == 0 {
			contextWindow = 128000
		}

		var existing store.ModelMapping
		err := h.s.DB.Where("model_id = ?", modelID).First(&existing).Error
		if err == nil {
			if !req.Overwrite {
				skipped++
				continue
			}
			updates := map[string]any{
				"vendor":              vendor,
				"upstream_id":         upstream.ID,
				"upstream_model_name": modelID,
				"context":             contextWindow,
				"status":              status,
			}
			if req.UpdatePrices {
				updates["input_price"] = inputPrice
				updates["output_price"] = outputPrice
				updates["cached_price"] = cachedPrice
				updates["cache_creation_price"] = cacheCreationPrice
			}
			if err := h.s.DB.Model(&existing).Updates(updates).Error; err != nil {
				skipped++
				continue
			}
			updated++
			continue
		}

		row := store.ModelMapping{
			ModelID:            modelID,
			Vendor:             vendor,
			UpstreamID:         upstream.ID,
			UpstreamModelName:  modelID,
			InputPrice:         inputPrice,
			OutputPrice:        outputPrice,
			CachedPrice:        cachedPrice,
			CacheCreationPrice: cacheCreationPrice,
			Context:            contextWindow,
			Status:             status,
			AllowedGroups:      allowedGroups,
		}
		if err := h.s.DB.Create(&row).Error; err != nil {
			skipped++
			continue
		}
		created++
	}
	now := time.Now()
	_ = h.s.DB.Model(&upstream).Updates(map[string]any{
		"last_check_at": now,
		"failure_count": 0,
		"last_error":    "",
	}).Error
	h.emitAudit(c, "admin.upstream.sync_models", fmt.Sprintf("upstream:%d", upstream.ID), gin.H{
		"created": created, "updated": updated, "skipped": skipped, "remote": len(models),
	})
	response.OK(c, gin.H{"created": created, "updated": updated, "skipped": skipped, "remote": len(models)})
}

type remoteModel struct {
	ID      string
	OwnedBy string
	Context int
}

func (h *Handler) fetchUpstreamModels(ctx context.Context, upstream store.Upstream) ([]remoteModel, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, upstreamModelsURL(upstream), nil)
	if err != nil {
		return nil, err
	}
	injectUpstreamAuth(req, upstream)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("upstream returned %d: %s", resp.StatusCode, truncateText(string(body), 200))
	}
	return parseRemoteModels(body)
}

func upstreamModelsURL(upstream store.Upstream) string {
	base := strings.TrimRight(upstream.BaseURL, "/")
	typ := strings.ToLower(strings.TrimSpace(upstream.Type))
	if typ == "gemini" || strings.Contains(base, "generativelanguage.googleapis.com") {
		if !strings.HasSuffix(base, "/v1beta") && !strings.HasSuffix(base, "/v1") {
			base += "/v1beta"
		}
		return base + "/models"
	}
	if !strings.HasSuffix(base, "/v1") {
		base += "/v1"
	}
	return base + "/models"
}

func injectUpstreamAuth(req *http.Request, upstream store.Upstream) {
	key := strings.TrimSpace(upstream.APIKey)
	if key == "" {
		return
	}
	typ := strings.ToLower(strings.TrimSpace(upstream.Type))
	switch typ {
	case "anthropic":
		req.Header.Set("x-api-key", key)
		req.Header.Set("anthropic-version", "2023-06-01")
	case "gemini":
		req.Header.Set("x-goog-api-key", key)
	default:
		req.Header.Set("Authorization", "Bearer "+key)
	}
}

func parseRemoteModels(body []byte) ([]remoteModel, error) {
	var openAI struct {
		Data []struct {
			ID      string `json:"id"`
			OwnedBy string `json:"owned_by"`
		} `json:"data"`
		Models []struct {
			Name            string `json:"name"`
			DisplayName     string `json:"displayName"`
			InputTokenLimit int    `json:"inputTokenLimit"`
		} `json:"models"`
	}
	if err := json.Unmarshal(body, &openAI); err != nil {
		return nil, err
	}
	out := make([]remoteModel, 0, len(openAI.Data)+len(openAI.Models))
	for _, item := range openAI.Data {
		id := strings.TrimSpace(item.ID)
		if id != "" {
			out = append(out, remoteModel{ID: id, OwnedBy: item.OwnedBy})
		}
	}
	for _, item := range openAI.Models {
		id := strings.TrimPrefix(strings.TrimSpace(item.Name), "models/")
		if id == "" {
			id = strings.TrimSpace(item.DisplayName)
		}
		if id != "" {
			out = append(out, remoteModel{ID: id, OwnedBy: "Google", Context: item.InputTokenLimit})
		}
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no models found in upstream response")
	}
	return out, nil
}

func defaultModelSnapshot(modelID string) (billing.DefaultModel, bool) {
	for _, m := range billing.DefaultModels {
		if m.ModelID == modelID {
			return m, true
		}
	}
	return billing.DefaultModel{}, false
}

func inferVendor(modelID, upstreamType, ownedBy string) string {
	if strings.TrimSpace(ownedBy) != "" && ownedBy != "getoken" {
		return ownedBy
	}
	s := strings.ToLower(modelID + " " + upstreamType)
	switch {
	case strings.Contains(s, "claude") || strings.Contains(s, "anthropic"):
		return "Anthropic"
	case strings.Contains(s, "gemini") || strings.Contains(s, "google"):
		return "Google"
	case strings.Contains(s, "gpt") || strings.Contains(s, "openai"):
		return "OpenAI"
	default:
		return strings.TrimSpace(upstreamType)
	}
}

func mustDecimal(raw string, fallback decimal.Decimal) decimal.Decimal {
	if strings.TrimSpace(raw) == "" {
		return fallback
	}
	v, err := decimal.NewFromString(raw)
	if err != nil {
		return fallback
	}
	return v
}

func truncateText(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n]
}
