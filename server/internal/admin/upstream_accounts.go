package admin

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/puppet/getoken/server/internal/pkg/errkit"
	"github.com/puppet/getoken/server/internal/response"
	"github.com/puppet/getoken/server/internal/store"
)

type upstreamAccountView struct {
	store.UpstreamAccount
	APIKeyMask            string `json:"apiKeyMask"`
	OAuthAccessTokenMask  string `json:"oauthAccessTokenMask"`
	OAuthRefreshTokenMask string `json:"oauthRefreshTokenMask"`
}

type upstreamAccountReq struct {
	UpstreamID        uint64 `json:"upstreamId" binding:"required"`
	Name              string `json:"name" binding:"required,max=64"`
	AccountType       string `json:"accountType"`
	APIKey            string `json:"apiKey"`
	OAuthAccessToken  string `json:"oauthAccessToken"`
	OAuthRefreshToken string `json:"oauthRefreshToken"`
	OAuthExpiresAt    string `json:"oauthExpiresAt"`
	ProxyURL          string `json:"proxyUrl"`
	Status            string `json:"status"`
	Priority          int    `json:"priority"`
	Weight            int    `json:"weight"`
	RPMLimit          int    `json:"rpmLimit"`
	TPMLimit          int    `json:"tpmLimit"`
	ConcurrencyLimit  int    `json:"concurrencyLimit"`
	Note              string `json:"note"`
}

func (h *Handler) listUpstreamAccounts(c *gin.Context) {
	q := h.s.DB.Model(&store.UpstreamAccount{})
	if upstreamID := c.Query("upstreamId"); upstreamID != "" {
		q = q.Where("upstream_id = ?", upstreamID)
	}
	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}

	var rows []store.UpstreamAccount
	if err := q.Order("upstream_id ASC, priority DESC, weight DESC, id ASC").Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	views := make([]upstreamAccountView, len(rows))
	for i, r := range rows {
		views[i] = viewUpstreamAccount(r)
	}
	response.OK(c, views)
}

func (h *Handler) createUpstreamAccount(c *gin.Context) {
	var req upstreamAccountReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	accountType := normalizeAccountType(req.AccountType, "apikey")
	hasCredential := strings.TrimSpace(req.APIKey) != "" || strings.TrimSpace(req.OAuthAccessToken) != ""
	if !hasCredential && !isOAuthAccountType(accountType) {
		response.Fail(c, errkit.BadRequest("凭证不能为空"))
		return
	}
	status := normalizeAccountStatus(req.Status, defaultAccountStatus(hasCredential))
	if !hasCredential {
		status = "degraded"
	}
	if !h.upstreamExists(req.UpstreamID) {
		response.Fail(c, errkit.BadRequest("上游不存在"))
		return
	}

	account := store.UpstreamAccount{
		UpstreamID:        req.UpstreamID,
		Name:              strings.TrimSpace(req.Name),
		AccountType:       accountType,
		APIKey:            strings.TrimSpace(req.APIKey),
		OAuthAccessToken:  strings.TrimSpace(req.OAuthAccessToken),
		OAuthRefreshToken: strings.TrimSpace(req.OAuthRefreshToken),
		OAuthExpiresAt:    parseOptionalTime(req.OAuthExpiresAt),
		ProxyURL:          strings.TrimSpace(req.ProxyURL),
		Status:            status,
		Priority:          defaultInt(req.Priority, 10),
		Weight:            defaultInt(req.Weight, 10),
		RPMLimit:          nonNegative(req.RPMLimit),
		TPMLimit:          nonNegative(req.TPMLimit),
		ConcurrencyLimit:  nonNegative(req.ConcurrencyLimit),
		Note:              req.Note,
	}
	if err := h.s.DB.Create(&account).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.emitAudit(c, "admin.upstream_account.create", fmt.Sprintf("upstream_account:%d", account.ID), gin.H{
		"upstreamId": account.UpstreamID,
		"name":       account.Name,
		"status":     account.Status,
		"priority":   account.Priority,
		"weight":     account.Weight,
	})
	response.Created(c, viewUpstreamAccount(account))
}

func (h *Handler) updateUpstreamAccount(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var account store.UpstreamAccount
	if err := h.s.DB.First(&account, id).Error; err != nil {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	var req upstreamAccountReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	if !h.upstreamExists(req.UpstreamID) {
		response.Fail(c, errkit.BadRequest("上游不存在"))
		return
	}

	updates := map[string]any{
		"upstream_id":       req.UpstreamID,
		"name":              strings.TrimSpace(req.Name),
		"account_type":      normalizeAccountType(req.AccountType, account.AccountType),
		"status":            normalizeAccountStatus(req.Status, account.Status),
		"priority":          defaultInt(req.Priority, account.Priority),
		"weight":            defaultInt(req.Weight, account.Weight),
		"rpm_limit":         nonNegative(req.RPMLimit),
		"tpm_limit":         nonNegative(req.TPMLimit),
		"concurrency_limit": nonNegative(req.ConcurrencyLimit),
		"oauth_expires_at":  parseOptionalTime(req.OAuthExpiresAt),
		"proxy_url":         strings.TrimSpace(req.ProxyURL),
		"note":              req.Note,
	}
	if strings.TrimSpace(req.APIKey) != "" {
		updates["api_key"] = strings.TrimSpace(req.APIKey)
	}
	if strings.TrimSpace(req.OAuthAccessToken) != "" {
		updates["oauth_access_token"] = strings.TrimSpace(req.OAuthAccessToken)
	}
	if strings.TrimSpace(req.OAuthRefreshToken) != "" {
		updates["oauth_refresh_token"] = strings.TrimSpace(req.OAuthRefreshToken)
	}
	if err := h.s.DB.Model(&account).Updates(updates).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.s.DB.First(&account, id)

	auditUpdates := make(map[string]any, len(updates))
	for k, v := range updates {
		if k == "api_key" || k == "oauth_access_token" || k == "oauth_refresh_token" {
			auditUpdates[k] = "***"
		} else {
			auditUpdates[k] = v
		}
	}
	h.emitAudit(c, "admin.upstream_account.update", fmt.Sprintf("upstream_account:%d", id), auditUpdates)
	response.OK(c, viewUpstreamAccount(account))
}

func (h *Handler) deleteUpstreamAccount(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if err := h.s.DB.Delete(&store.UpstreamAccount{}, id).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.emitAudit(c, "admin.upstream_account.delete", fmt.Sprintf("upstream_account:%d", id), nil)
	response.OK(c, gin.H{"ok": true})
}

func (h *Handler) checkUpstreamAccount(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var account store.UpstreamAccount
	if err := h.s.DB.First(&account, id).Error; err != nil {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	var upstream store.Upstream
	if err := h.s.DB.First(&upstream, account.UpstreamID).Error; err != nil {
		response.Fail(c, errkit.BadRequest("上游不存在"))
		return
	}

	latency, status, errMsg := probeUpstreamAccount(c.Request.Context(), upstream, account)
	now := time.Now()
	updates := map[string]any{
		"status":        status,
		"latency_ms":    latency,
		"last_check_at": now,
		"last_error":    errMsg,
	}
	if err := h.s.DB.Model(&account).Updates(updates).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.s.DB.First(&account, id)
	h.emitAudit(c, "admin.upstream_account.check", fmt.Sprintf("upstream_account:%d", id), gin.H{
		"status":    status,
		"latencyMs": latency,
	})
	response.OK(c, viewUpstreamAccount(account))
}

func (h *Handler) recoverUpstreamAccount(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var account store.UpstreamAccount
	if err := h.s.DB.First(&account, id).Error; err != nil {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	now := time.Now()
	updates := map[string]any{"status": "online", "last_error": "", "last_check_at": now}
	if err := h.s.DB.Model(&account).Updates(updates).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	if h.s.Redis != nil {
		_ = h.s.Redis.Del(c.Request.Context(), upstreamAccountCooldownKey(id)).Err()
	}
	h.s.DB.First(&account, id)
	h.emitAudit(c, "admin.upstream_account.recover", fmt.Sprintf("upstream_account:%d", id), gin.H{"status": "online"})
	response.OK(c, viewUpstreamAccount(account))
}

func (h *Handler) upstreamExists(id uint64) bool {
	if id == 0 {
		return false
	}
	var count int64
	return h.s.DB.Model(&store.Upstream{}).Where("id = ?", id).Count(&count).Error == nil && count > 0
}

func probeUpstreamAccount(parent context.Context, upstream store.Upstream, account store.UpstreamAccount) (int, string, string) {
	ctx, cancel := context.WithTimeout(parent, 12*time.Second)
	defer cancel()

	base := strings.TrimRight(upstream.BaseURL, "/")
	path := []string{"v1", "models"}
	if strings.HasSuffix(base, "/v1") {
		path = []string{"models"}
	}
	target, err := url.JoinPath(base, path...)
	if err != nil {
		return 0, "offline", "invalid base url: " + err.Error()
	}
	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return 0, "offline", err.Error()
	}
	writeProbeAuth(req, upstream, accountCredential(account))

	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	latency := int(time.Since(start).Milliseconds())
	if err != nil {
		return latency, "offline", err.Error()
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return latency, "online", ""
	case resp.StatusCode == http.StatusTooManyRequests:
		return latency, "degraded", "rate limited"
	case resp.StatusCode >= 500:
		return latency, "degraded", resp.Status
	default:
		return latency, "offline", resp.Status
	}
}

func writeProbeAuth(req *http.Request, upstream store.Upstream, apiKey string) {
	upstreamType := strings.ToLower(upstream.Type)
	if strings.Contains(upstreamType, "anthropic") {
		req.Header.Set("x-api-key", apiKey)
		req.Header.Set("anthropic-version", "2023-06-01")
		return
	}
	if strings.Contains(upstreamType, "gemini") || strings.Contains(upstreamType, "google") {
		req.Header.Set("x-goog-api-key", apiKey)
		return
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
}

func normalizeAccountStatus(v, def string) string {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "online", "degraded", "offline", "cooling":
		return strings.ToLower(strings.TrimSpace(v))
	default:
		return def
	}
}

func normalizeAccountType(v, def string) string {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "oauth", "oauth_code", "setup-token", "oauth_setup_token", "apikey", "upstream", "service_account":
		return strings.ToLower(strings.TrimSpace(v))
	default:
		if strings.TrimSpace(def) == "" {
			return "apikey"
		}
		return def
	}
}

func isOAuthAccountType(v string) bool {
	return strings.Contains(strings.ToLower(strings.TrimSpace(v)), "oauth")
}

func defaultAccountStatus(hasCredential bool) string {
	if hasCredential {
		return "online"
	}
	return "degraded"
}

func parseOptionalTime(raw string) *time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02"} {
		if t, err := time.Parse(layout, raw); err == nil {
			return &t
		}
	}
	return nil
}

func viewUpstreamAccount(account store.UpstreamAccount) upstreamAccountView {
	return upstreamAccountView{
		UpstreamAccount:       account,
		APIKeyMask:            maskSecret(account.APIKey),
		OAuthAccessTokenMask:  maskSecret(account.OAuthAccessToken),
		OAuthRefreshTokenMask: maskSecret(account.OAuthRefreshToken),
	}
}

func accountCredential(account store.UpstreamAccount) string {
	if strings.TrimSpace(account.OAuthAccessToken) != "" {
		return strings.TrimSpace(account.OAuthAccessToken)
	}
	return strings.TrimSpace(account.APIKey)
}

func upstreamAccountCooldownKey(id uint64) string {
	return fmt.Sprintf("relay:upstream-account:%d:cooldown", id)
}

func nonNegative(v int) int {
	if v < 0 {
		return 0
	}
	return v
}
