package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/puppet/getoken/server/internal/pkg/errkit"
	"github.com/puppet/getoken/server/internal/pkg/idgen"
	"github.com/puppet/getoken/server/internal/response"
	"github.com/puppet/getoken/server/internal/store"
)

func (h *Handler) RegisterPublic(rg *gin.RouterGroup) {
	rg.GET("/upstream/callback", h.oauthUpstreamCallback)
	rg.POST("/upstream/callback", h.oauthUpstreamCallback)
}

type oauthStartState struct {
	AccountID   uint64    `json:"accountId"`
	UpstreamID  uint64    `json:"upstreamId"`
	Provider    string    `json:"provider"`
	RedirectURI string    `json:"redirectUri"`
	CreatedAt   time.Time `json:"createdAt"`
	ExpiresAt   time.Time `json:"expiresAt"`
}

func (h *Handler) startUpstreamAccountOAuth(c *gin.Context) {
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
	provider := strings.ToLower(strings.TrimSpace(upstream.Type))
	authURL := firstNonEmpty(
		adminSettingString(h.s.DB, "oauth."+provider+".authUrl"),
		adminSettingString(h.s.DB, "oauth.authUrl"),
		defaultOAuthAuthURL(provider),
	)
	clientID := firstNonEmpty(
		adminSettingString(h.s.DB, "oauth."+provider+".clientId"),
		adminSettingString(h.s.DB, "oauth.clientId"),
	)
	redirectURI := firstNonEmpty(
		adminSettingString(h.s.DB, "oauth."+provider+".redirectUrl"),
		adminSettingString(h.s.DB, "oauth.redirectUrl"),
		defaultOAuthRedirectURL(c),
	)
	scopes := firstNonEmpty(
		adminSettingString(h.s.DB, "oauth."+provider+".scopes"),
		adminSettingString(h.s.DB, "oauth.scopes"),
		defaultOAuthScopes(provider),
	)
	if authURL == "" || clientID == "" {
		response.Fail(c, errkit.BadRequest("缺少 OAuth authUrl 或 clientId 配置"))
		return
	}
	state := idgen.RandomHex(18)
	payload := oauthStartState{
		AccountID:   account.ID,
		UpstreamID:  upstream.ID,
		Provider:    provider,
		RedirectURI: redirectURI,
		CreatedAt:   time.Now(),
		ExpiresAt:   time.Now().Add(10 * time.Minute),
	}
	raw, _ := json.Marshal(payload)
	if err := h.s.DB.Save(&store.Setting{Key: oauthStateSettingKey(state), Value: string(raw)}).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	u, err := url.Parse(authURL)
	if err != nil {
		response.Fail(c, errkit.BadRequest("OAuth authUrl 无效"))
		return
	}
	q := u.Query()
	q.Set("response_type", "code")
	q.Set("client_id", clientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("state", state)
	if scopes != "" {
		q.Set("scope", scopes)
	}
	q.Set("access_type", "offline")
	q.Set("prompt", "consent")
	u.RawQuery = q.Encode()
	h.emitAudit(c, "admin.upstream_account.oauth_start", fmt.Sprintf("upstream_account:%d", account.ID), gin.H{"upstreamId": upstream.ID, "provider": provider})
	response.OK(c, gin.H{"authUrl": u.String(), "expiresAt": payload.ExpiresAt})
}

func (h *Handler) oauthUpstreamCallback(c *gin.Context) {
	if errMsg := strings.TrimSpace(c.Query("error")); errMsg != "" {
		h.oauthCallbackHTML(c, false, "授权失败", errMsg)
		return
	}
	code := strings.TrimSpace(c.Query("code"))
	state := strings.TrimSpace(c.Query("state"))
	if code == "" {
		code = strings.TrimSpace(c.PostForm("code"))
	}
	if state == "" {
		state = strings.TrimSpace(c.PostForm("state"))
	}
	if code == "" || state == "" {
		h.oauthCallbackHTML(c, false, "授权参数缺失", "回调缺少 code 或 state。")
		return
	}
	payload, err := h.loadOAuthState(state)
	if err != nil {
		h.oauthCallbackHTML(c, false, "授权状态无效", err.Error())
		return
	}
	defer h.deleteOAuthState(state)
	if time.Now().After(payload.ExpiresAt) {
		h.oauthCallbackHTML(c, false, "授权已过期", "请回到后台重新发起 OAuth 授权。")
		return
	}
	var account store.UpstreamAccount
	if err := h.s.DB.First(&account, payload.AccountID).Error; err != nil {
		h.oauthCallbackHTML(c, false, "账号不存在", "找不到要绑定的上游账号。")
		return
	}
	var upstream store.Upstream
	if err := h.s.DB.First(&upstream, payload.UpstreamID).Error; err != nil {
		h.oauthCallbackHTML(c, false, "上游不存在", "找不到要绑定的上游网关。")
		return
	}
	token, err := h.exchangeOAuthCode(c.Request.Context(), upstream, account, code, payload.RedirectURI)
	if err != nil {
		_ = h.s.DB.Model(&account).Updates(map[string]any{
			"status":     "degraded",
			"last_error": truncateText(err.Error(), 512),
		}).Error
		h.oauthCallbackHTML(c, false, "换取 Token 失败", err.Error())
		return
	}
	if err := h.applyOAuthToken(&account, token); err != nil {
		h.oauthCallbackHTML(c, false, "保存 Token 失败", "数据库写入失败。")
		return
	}
	h.emitAudit(c, "admin.upstream_account.oauth_callback", fmt.Sprintf("upstream_account:%d", account.ID), gin.H{"upstreamId": upstream.ID, "provider": payload.Provider})
	h.oauthCallbackHTML(c, true, "OAuth 授权成功", "Access Token 已写入账号池，可以关闭此页面回到后台。")
}

func (h *Handler) refreshUpstreamAccountOAuth(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var account store.UpstreamAccount
	if err := h.s.DB.First(&account, id).Error; err != nil {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	if strings.TrimSpace(account.OAuthRefreshToken) == "" {
		response.Fail(c, errkit.BadRequest("该账号没有 OAuth Refresh Token"))
		return
	}
	var upstream store.Upstream
	if err := h.s.DB.First(&upstream, account.UpstreamID).Error; err != nil {
		response.Fail(c, errkit.BadRequest("上游不存在"))
		return
	}
	token, err := h.refreshOAuthToken(c.Request.Context(), upstream, account)
	if err != nil {
		_ = h.s.DB.Model(&account).Updates(map[string]any{
			"status":     "degraded",
			"last_error": truncateText(err.Error(), 512),
		}).Error
		response.Fail(c, errkit.BadRequest("刷新失败: "+err.Error()))
		return
	}
	if err := h.applyOAuthToken(&account, token); err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.s.DB.First(&account, id)
	h.emitAudit(c, "admin.upstream_account.oauth_refresh", fmt.Sprintf("upstream_account:%d", id), gin.H{
		"upstreamId": account.UpstreamID,
	})
	response.OK(c, viewUpstreamAccount(account))
}

type oauthRefreshResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	Error        string `json:"error"`
	ErrorDesc    string `json:"error_description"`
}

func (h *Handler) refreshOAuthToken(ctx context.Context, upstream store.Upstream, account store.UpstreamAccount) (oauthRefreshResponse, error) {
	provider := strings.ToLower(strings.TrimSpace(upstream.Type))
	tokenURL := firstNonEmpty(
		adminSettingString(h.s.DB, "oauth."+provider+".tokenUrl"),
		adminSettingString(h.s.DB, "oauth.tokenUrl"),
		defaultOAuthTokenURL(provider),
	)
	clientID := firstNonEmpty(
		adminSettingString(h.s.DB, "oauth."+provider+".clientId"),
		adminSettingString(h.s.DB, "oauth.clientId"),
	)
	clientSecret := firstNonEmpty(
		adminSettingString(h.s.DB, "oauth."+provider+".clientSecret"),
		adminSettingString(h.s.DB, "oauth.clientSecret"),
	)
	if tokenURL == "" {
		return oauthRefreshResponse{}, fmt.Errorf("missing oauth tokenUrl for provider %s", provider)
	}
	values := url.Values{}
	values.Set("grant_type", "refresh_token")
	values.Set("refresh_token", strings.TrimSpace(account.OAuthRefreshToken))
	if clientID != "" {
		values.Set("client_id", clientID)
	}
	if clientSecret != "" {
		values.Set("client_secret", clientSecret)
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(values.Encode()))
	if err != nil {
		return oauthRefreshResponse{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return oauthRefreshResponse{}, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return oauthRefreshResponse{}, err
	}
	var out oauthRefreshResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return oauthRefreshResponse{}, err
	}
	if resp.StatusCode >= 400 || out.Error != "" {
		msg := firstNonEmpty(out.ErrorDesc, out.Error, truncateText(string(body), 200))
		return oauthRefreshResponse{}, fmt.Errorf("oauth token endpoint returned %d: %s", resp.StatusCode, msg)
	}
	if strings.TrimSpace(out.AccessToken) == "" {
		return oauthRefreshResponse{}, fmt.Errorf("oauth response missing access_token")
	}
	return out, nil
}

func (h *Handler) exchangeOAuthCode(ctx context.Context, upstream store.Upstream, account store.UpstreamAccount, code, redirectURI string) (oauthRefreshResponse, error) {
	provider := strings.ToLower(strings.TrimSpace(upstream.Type))
	tokenURL := firstNonEmpty(
		adminSettingString(h.s.DB, "oauth."+provider+".tokenUrl"),
		adminSettingString(h.s.DB, "oauth.tokenUrl"),
		defaultOAuthTokenURL(provider),
	)
	clientID := firstNonEmpty(
		adminSettingString(h.s.DB, "oauth."+provider+".clientId"),
		adminSettingString(h.s.DB, "oauth.clientId"),
	)
	clientSecret := firstNonEmpty(
		adminSettingString(h.s.DB, "oauth."+provider+".clientSecret"),
		adminSettingString(h.s.DB, "oauth.clientSecret"),
	)
	if tokenURL == "" || clientID == "" {
		return oauthRefreshResponse{}, fmt.Errorf("missing oauth tokenUrl or clientId for provider %s", provider)
	}
	values := url.Values{}
	values.Set("grant_type", "authorization_code")
	values.Set("code", code)
	values.Set("redirect_uri", redirectURI)
	values.Set("client_id", clientID)
	if clientSecret != "" {
		values.Set("client_secret", clientSecret)
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(values.Encode()))
	if err != nil {
		return oauthRefreshResponse{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return oauthRefreshResponse{}, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return oauthRefreshResponse{}, err
	}
	var out oauthRefreshResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return oauthRefreshResponse{}, err
	}
	if resp.StatusCode >= 400 || out.Error != "" {
		msg := firstNonEmpty(out.ErrorDesc, out.Error, truncateText(string(body), 200))
		return oauthRefreshResponse{}, fmt.Errorf("oauth token endpoint returned %d: %s", resp.StatusCode, msg)
	}
	if strings.TrimSpace(out.AccessToken) == "" {
		return oauthRefreshResponse{}, fmt.Errorf("oauth response missing access_token")
	}
	return out, nil
}

func (h *Handler) applyOAuthToken(account *store.UpstreamAccount, token oauthRefreshResponse) error {
	updates := map[string]any{
		"oauth_access_token": token.AccessToken,
		"status":             "online",
		"last_error":         "",
		"last_check_at":      time.Now(),
	}
	if strings.TrimSpace(token.RefreshToken) != "" {
		updates["oauth_refresh_token"] = token.RefreshToken
	}
	if token.ExpiresIn > 0 {
		expiresAt := time.Now().Add(time.Duration(token.ExpiresIn) * time.Second)
		updates["oauth_expires_at"] = expiresAt
	}
	if err := h.s.DB.Model(account).Updates(updates).Error; err != nil {
		return err
	}
	h.s.DB.First(account, account.ID)
	return nil
}

func (h *Handler) loadOAuthState(state string) (oauthStartState, error) {
	var row store.Setting
	if err := h.s.DB.Where("key = ?", oauthStateSettingKey(state)).First(&row).Error; err != nil {
		return oauthStartState{}, fmt.Errorf("state 不存在或已使用")
	}
	var payload oauthStartState
	if err := json.Unmarshal([]byte(row.Value), &payload); err != nil {
		return oauthStartState{}, fmt.Errorf("state 格式错误")
	}
	return payload, nil
}

func (h *Handler) deleteOAuthState(state string) {
	_ = h.s.DB.Where("key = ?", oauthStateSettingKey(state)).Delete(&store.Setting{}).Error
}

func oauthStateSettingKey(state string) string {
	return "oauth.state." + state
}

func (h *Handler) oauthCallbackHTML(c *gin.Context, ok bool, title, message string) {
	status := http.StatusOK
	color := "#22c55e"
	if !ok {
		status = http.StatusBadRequest
		color = "#ef4444"
	}
	title = html.EscapeString(title)
	message = html.EscapeString(message)
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(status, `<!doctype html><html><head><meta charset="utf-8"><title>%s</title><style>body{margin:0;background:#070707;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;min-height:100vh;place-items:center}.box{width:min(520px,calc(100vw - 32px));border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:28px;background:rgba(255,255,255,.04)}.dot{width:12px;height:12px;border-radius:999px;background:%s;box-shadow:0 0 24px %s}h1{font-size:24px;margin:18px 0 8px}p{color:#a1a1aa;line-height:1.7}a{color:#fff}</style></head><body><main class="box"><div class="dot"></div><h1>%s</h1><p>%s</p><p><a href="/admin/channels">返回上游网关</a></p></main></body></html>`, title, color, color, title, message)
}

func defaultOAuthAuthURL(provider string) string {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "gemini", "google", "service_account":
		return "https://accounts.google.com/o/oauth2/v2/auth"
	default:
		return ""
	}
}

func defaultOAuthTokenURL(provider string) string {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "gemini", "google", "service_account":
		return "https://oauth2.googleapis.com/token"
	default:
		return ""
	}
}

func defaultOAuthScopes(provider string) string {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "gemini", "google", "service_account":
		return "https://www.googleapis.com/auth/cloud-platform"
	default:
		return ""
	}
}

func defaultOAuthRedirectURL(c *gin.Context) string {
	proto := firstNonEmpty(c.GetHeader("X-Forwarded-Proto"))
	if proto == "" {
		if c.Request.TLS != nil {
			proto = "https"
		} else {
			proto = "http"
		}
	}
	host := firstNonEmpty(c.GetHeader("X-Forwarded-Host"), c.Request.Host)
	return proto + "://" + host + "/api/oauth/upstream/callback"
}

func adminSettingString(db *gorm.DB, key string) string {
	if db == nil {
		return ""
	}
	var rows []store.Setting
	if err := db.Where("key = ?", key).Limit(1).Find(&rows).Error; err != nil || len(rows) == 0 {
		return ""
	}
	var v any
	if err := json.Unmarshal([]byte(rows[0].Value), &v); err != nil {
		return strings.Trim(rows[0].Value, `"`)
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprint(v)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
