package relay

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/puppet/getoken/server/internal/store"
)

const maxBodyBytes = 10 << 20 // 10 MiB

// RouteResult 聚合一次请求计费 / 转发所需的全部上下文。
type RouteResult struct {
	UserID          uint64
	Model           *store.ModelMapping
	Upstream        *store.Upstream
	UpstreamAccount *store.UpstreamAccount
	UpstreamAPIKey  string
	AccountLeaseKey string
	SessionID       string
	StickyKey       string
	Group           *store.Group
	OriginalBody    []byte // 已经把 model 字段替换成 UpstreamModelName 的新 body
	RawBody         []byte // 原始 body（用于预估 token / 留档）
	ModelName       string // 用户请求时填的 model（原值）
	Stream          bool
	MaxTokens       int
	ReasoningEffort string // low/medium/high/minimal/xhigh/max；Anthropic thinking 模式按 budget_tokens 推导
}

// ResolveRoute 读 body → 找 model_mapping → 校验上游 → 替换模型名 → 重设 body。
func ResolveRoute(c *gin.Context, s *store.Store, user *store.User) (*RouteResult, error) {
	// 限制 body 大小。
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBodyBytes)
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		// 区分超限与其他错误。
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return nil, newRelayErr(http.StatusRequestEntityTooLarge, "invalid_request_error",
				"payload_too_large", "request body exceeds 10MiB")
		}
		return nil, newRelayErr(http.StatusBadRequest, "invalid_request_error",
			"body_read_failed", "could not read request body: "+err.Error())
	}
	_ = c.Request.Body.Close()

	if len(raw) == 0 {
		return nil, newRelayErr(http.StatusBadRequest, "invalid_request_error",
			"empty_body", "request body is empty")
	}

	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, newRelayErr(http.StatusBadRequest, "invalid_request_error",
			"invalid_json", "request body is not valid JSON: "+err.Error())
	}

	modelName, _ := payload["model"].(string)
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return nil, newRelayErr(http.StatusBadRequest, "invalid_request_error",
			"missing_model", "request body is missing the required 'model' field")
	}

	stream := false
	if v, ok := payload["stream"].(bool); ok {
		stream = v
	}
	maxTokens := 0
	if v, ok := payload["max_tokens"].(float64); ok {
		maxTokens = int(v)
	} else if v, ok := payload["max_completion_tokens"].(float64); ok {
		// OpenAI 新参数。
		maxTokens = int(v)
	} else if v, ok := payload["max_output_tokens"].(float64); ok {
		// OpenAI Responses API。
		maxTokens = int(v)
	}

	reasoningEffort := parseReasoningEffort(payload)
	sessionID := extractSessionID(c, payload)

	// 加载模型 mapping。
	var mapping store.ModelMapping
	if err := s.DB.Where("model_id = ? AND status = ?", modelName, "online").First(&mapping).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, newRelayErr(http.StatusNotFound, "invalid_request_error",
				"model_not_found", "model '"+modelName+"' is not available")
		}
		return nil, newRelayErr(http.StatusInternalServerError, "api_error",
			"store_error", "could not load model mapping")
	}

	// 上游。
	var upstream store.Upstream
	if err := s.DB.First(&upstream, mapping.UpstreamID).Error; err != nil {
		return nil, newRelayErr(http.StatusServiceUnavailable, "api_error",
			"upstream_missing", "upstream channel is not configured")
	}
	if upstream.Status != "online" {
		return nil, newRelayErr(http.StatusServiceUnavailable, "api_error",
			"upstream_offline", "upstream channel is currently unavailable")
	}
	account, leaseKey, stickyKey, hasPool, err := selectUpstreamAccount(c.Request.Context(), s, user.ID, upstream.ID, sessionID, nil)
	if err != nil || hasPool && account == nil {
		return nil, newRelayErr(http.StatusServiceUnavailable, "api_error",
			"upstream_account_unavailable", "upstream account pool has no usable account")
	}
	upstreamAPIKey := upstream.APIKey
	if account != nil {
		upstreamAPIKey = accountCredential(account)
		markAccountUsed(s, account.ID)
	}

	// 用户分组。
	var grp store.Group
	if err := s.DB.First(&grp, user.GroupID).Error; err != nil {
		// 兜底用默认 ratio=1。
		grp = store.Group{ID: user.GroupID, Name: "default"}
	}

	// AllowedGroups 校验。
	if !groupAllowed(mapping.AllowedGroups, grp.Name) {
		return nil, newRelayErr(http.StatusForbidden, "invalid_request_error",
			"model_forbidden", "your group is not allowed to use this model")
	}

	// 替换 body 里的 model 字段为上游真实名；流式 OpenAI 要塞 include_usage。
	payload["model"] = mapping.UpstreamModelName
	if stream {
		ensureIncludeUsage(payload)
	}
	newBody, err := json.Marshal(payload)
	if err != nil {
		return nil, newRelayErr(http.StatusInternalServerError, "api_error",
			"marshal_failed", "failed to rebuild request body")
	}

	// 把新 body 写回 request。
	c.Request.Body = io.NopCloser(bytes.NewReader(newBody))
	c.Request.ContentLength = int64(len(newBody))
	c.Request.Header.Set("Content-Length", itoa(len(newBody)))

	return &RouteResult{
		UserID:          user.ID,
		Model:           &mapping,
		Upstream:        &upstream,
		UpstreamAccount: account,
		UpstreamAPIKey:  upstreamAPIKey,
		AccountLeaseKey: leaseKey,
		SessionID:       sessionID,
		StickyKey:       stickyKey,
		Group:           &grp,
		OriginalBody:    newBody,
		RawBody:         raw,
		ModelName:       modelName,
		Stream:          stream,
		MaxTokens:       maxTokens,
		ReasoningEffort: reasoningEffort,
	}, nil
}

// ResolveGeminiRoute handles native Gemini paths:
//
//	/v1beta/models/{model}:generateContent
//	/v1beta/models/{model}:streamGenerateContent
//
// Gemini carries the model in the path instead of the JSON body, so we resolve
// the mapping from the path and rewrite the outgoing path to the upstream model.
func ResolveGeminiRoute(c *gin.Context, s *store.Store, user *store.User) (*RouteResult, error) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBodyBytes)
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return nil, newRelayErr(http.StatusRequestEntityTooLarge, "invalid_request_error",
				"payload_too_large", "request body exceeds 10MiB")
		}
		return nil, newRelayErr(http.StatusBadRequest, "invalid_request_error",
			"body_read_failed", "could not read request body: "+err.Error())
	}
	_ = c.Request.Body.Close()

	if len(raw) == 0 {
		return nil, newRelayErr(http.StatusBadRequest, "invalid_request_error",
			"empty_body", "request body is empty")
	}

	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, newRelayErr(http.StatusBadRequest, "invalid_request_error",
			"invalid_json", "request body is not valid JSON: "+err.Error())
	}

	modelName, action := parseGeminiModelAction(c.Param("modelAction"))
	if modelName == "" {
		return nil, newRelayErr(http.StatusBadRequest, "invalid_request_error",
			"missing_model", "Gemini path is missing model name")
	}
	if action != "generateContent" && action != "streamGenerateContent" {
		return nil, newRelayErr(http.StatusNotImplemented, "invalid_request_error",
			"unsupported_gemini_action", "Gemini action '"+action+"' is not supported")
	}

	stream := action == "streamGenerateContent"
	maxTokens := parseGeminiMaxTokens(payload)
	sessionID := extractSessionID(c, payload)

	var mapping store.ModelMapping
	if err := s.DB.Where("model_id = ? AND status = ?", modelName, "online").First(&mapping).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, newRelayErr(http.StatusNotFound, "invalid_request_error",
				"model_not_found", "model '"+modelName+"' is not available")
		}
		return nil, newRelayErr(http.StatusInternalServerError, "api_error",
			"store_error", "could not load model mapping")
	}

	var upstream store.Upstream
	if err := s.DB.First(&upstream, mapping.UpstreamID).Error; err != nil {
		return nil, newRelayErr(http.StatusServiceUnavailable, "api_error",
			"upstream_missing", "upstream channel is not configured")
	}
	if upstream.Status != "online" {
		return nil, newRelayErr(http.StatusServiceUnavailable, "api_error",
			"upstream_offline", "upstream channel is currently unavailable")
	}
	account, leaseKey, stickyKey, hasPool, err := selectUpstreamAccount(c.Request.Context(), s, user.ID, upstream.ID, sessionID, nil)
	if err != nil || hasPool && account == nil {
		return nil, newRelayErr(http.StatusServiceUnavailable, "api_error",
			"upstream_account_unavailable", "upstream account pool has no usable account")
	}
	upstreamAPIKey := upstream.APIKey
	if account != nil {
		upstreamAPIKey = accountCredential(account)
		markAccountUsed(s, account.ID)
	}

	var grp store.Group
	if err := s.DB.First(&grp, user.GroupID).Error; err != nil {
		grp = store.Group{ID: user.GroupID, Name: "default"}
	}
	if !groupAllowed(mapping.AllowedGroups, grp.Name) {
		return nil, newRelayErr(http.StatusForbidden, "invalid_request_error",
			"model_forbidden", "your group is not allowed to use this model")
	}

	rewriteGeminiURL(c.Request.URL, mapping.UpstreamModelName, action, stream)
	c.Request.Body = io.NopCloser(bytes.NewReader(raw))
	c.Request.ContentLength = int64(len(raw))
	c.Request.Header.Set("Content-Length", itoa(len(raw)))

	return &RouteResult{
		UserID:          user.ID,
		Model:           &mapping,
		Upstream:        &upstream,
		UpstreamAccount: account,
		UpstreamAPIKey:  upstreamAPIKey,
		AccountLeaseKey: leaseKey,
		SessionID:       sessionID,
		StickyKey:       stickyKey,
		Group:           &grp,
		OriginalBody:    raw,
		RawBody:         raw,
		ModelName:       modelName,
		Stream:          stream,
		MaxTokens:       maxTokens,
	}, nil
}

func parseGeminiModelAction(raw string) (string, string) {
	raw = strings.TrimSpace(raw)
	model, action, ok := strings.Cut(raw, ":")
	if !ok {
		return raw, ""
	}
	return strings.TrimSpace(model), strings.TrimSpace(action)
}

func parseGeminiMaxTokens(payload map[string]any) int {
	cfg, _ := payload["generationConfig"].(map[string]any)
	if cfg == nil {
		cfg, _ = payload["generation_config"].(map[string]any)
	}
	if cfg == nil {
		return 0
	}
	if v, ok := cfg["maxOutputTokens"].(float64); ok {
		return int(v)
	}
	if v, ok := cfg["max_output_tokens"].(float64); ok {
		return int(v)
	}
	return 0
}

func rewriteGeminiURL(u *url.URL, upstreamModelName, action string, stream bool) {
	u.Path = "/v1beta/models/" + url.PathEscape(upstreamModelName) + ":" + action
	q := u.Query()
	q.Del("key")
	if stream && q.Get("alt") == "" {
		q.Set("alt", "sse")
	}
	u.RawQuery = q.Encode()
}

func selectUpstreamAccount(ctx context.Context, s *store.Store, userID, upstreamID uint64, sessionID string, exclude map[uint64]bool) (*store.UpstreamAccount, string, string, bool, error) {
	var count int64
	if err := s.DB.Model(&store.UpstreamAccount{}).Where("upstream_id = ?", upstreamID).Count(&count).Error; err != nil {
		return nil, "", "", false, err
	}
	if count == 0 {
		return nil, "", "", false, nil
	}

	stickyKey := ""
	if strings.TrimSpace(sessionID) != "" {
		stickyKey = accountStickyKey(userID, upstreamID, sessionID)
		if account, leaseKey, ok := tryStickyAccount(ctx, s, stickyKey, upstreamID, exclude); ok {
			return account, leaseKey, stickyKey, true, nil
		}
	}

	account, leaseKey, err := pickAccountByStatus(ctx, s, upstreamID, "online", exclude)
	if err == nil {
		rememberStickyAccount(ctx, s, stickyKey, account)
		return account, leaseKey, stickyKey, true, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, "", stickyKey, true, err
	}
	account, leaseKey, err = pickAccountByStatus(ctx, s, upstreamID, "degraded", exclude)
	if err == nil {
		rememberStickyAccount(ctx, s, stickyKey, account)
		return account, leaseKey, stickyKey, true, nil
	}
	return nil, "", stickyKey, true, err
}

func tryStickyAccount(ctx context.Context, s *store.Store, stickyKey string, upstreamID uint64, exclude map[uint64]bool) (*store.UpstreamAccount, string, bool) {
	if s.Redis == nil || stickyKey == "" {
		return nil, "", false
	}
	raw, err := s.Redis.Get(ctx, stickyKey).Uint64()
	if err != nil || raw == 0 || excludedAccount(raw, exclude) {
		_ = s.Redis.Del(ctx, stickyKey).Err()
		return nil, "", false
	}
	var account store.UpstreamAccount
	if err := s.DB.Where("id = ? AND upstream_id = ? AND status IN ?", raw, upstreamID, []string{"online", "degraded"}).First(&account).Error; err != nil {
		_ = s.Redis.Del(ctx, stickyKey).Err()
		return nil, "", false
	}
	if !accountWithinLimits(ctx, s, account) {
		return nil, "", false
	}
	leaseKey, ok := reserveAccountLimits(ctx, s, &account)
	if !ok {
		return nil, "", false
	}
	return &account, leaseKey, true
}

func rememberStickyAccount(ctx context.Context, s *store.Store, stickyKey string, account *store.UpstreamAccount) {
	if s.Redis == nil || stickyKey == "" || account == nil {
		return
	}
	_ = s.Redis.Set(ctx, stickyKey, account.ID, 24*time.Hour).Err()
}

func pickAccountByStatus(ctx context.Context, s *store.Store, upstreamID uint64, status string, exclude map[uint64]bool) (*store.UpstreamAccount, string, error) {
	var rows []store.UpstreamAccount
	if err := s.DB.
		Where("upstream_id = ? AND status = ?", upstreamID, status).
		Order("priority DESC, weight DESC, last_used_at ASC NULLS FIRST, id ASC").
		Find(&rows).Error; err != nil {
		return nil, "", err
	}
	if len(rows) == 0 {
		return nil, "", gorm.ErrRecordNotFound
	}

	topPriority := rows[0].Priority
	candidates := make([]store.UpstreamAccount, 0, len(rows))
	totalWeight := 0
	for _, row := range rows {
		if row.Priority != topPriority {
			break
		}
		if excludedAccount(row.ID, exclude) {
			continue
		}
		if !accountWithinLimits(ctx, s, row) {
			continue
		}
		weight := row.Weight
		if weight <= 0 {
			weight = 1
		}
		totalWeight += weight
		candidates = append(candidates, row)
	}
	if len(candidates) == 0 {
		return nil, "", gorm.ErrRecordNotFound
	}
	if len(candidates) == 1 || totalWeight <= 1 {
		leaseKey, ok := reserveAccountLimits(ctx, s, &candidates[0])
		if !ok {
			return nil, "", gorm.ErrRecordNotFound
		}
		return &candidates[0], leaseKey, nil
	}

	n := rand.New(rand.NewSource(time.Now().UnixNano())).Intn(totalWeight)
	for i := range candidates {
		weight := candidates[i].Weight
		if weight <= 0 {
			weight = 1
		}
		if n < weight {
			leaseKey, ok := reserveAccountLimits(ctx, s, &candidates[i])
			if !ok {
				return nil, "", gorm.ErrRecordNotFound
			}
			return &candidates[i], leaseKey, nil
		}
		n -= weight
	}
	leaseKey, ok := reserveAccountLimits(ctx, s, &candidates[0])
	if !ok {
		return nil, "", gorm.ErrRecordNotFound
	}
	return &candidates[0], leaseKey, nil
}

func accountWithinLimits(ctx context.Context, s *store.Store, account store.UpstreamAccount) bool {
	if s.Redis == nil {
		return true
	}
	if accountCooling(ctx, s, account.ID) {
		return false
	}
	if account.RPMLimit > 0 {
		n, err := s.Redis.Get(ctx, accountRPMKey(account.ID)).Int()
		if err == nil && n >= account.RPMLimit {
			return false
		}
	}
	if account.ConcurrencyLimit > 0 {
		n, err := s.Redis.Get(ctx, accountConcurrencyKey(account.ID)).Int()
		if err == nil && n >= account.ConcurrencyLimit {
			return false
		}
	}
	return true
}

func reserveAccountLimits(ctx context.Context, s *store.Store, account *store.UpstreamAccount) (string, bool) {
	if s.Redis == nil || account == nil {
		return "", true
	}
	if account.RPMLimit > 0 {
		key := accountRPMKey(account.ID)
		n, err := s.Redis.Incr(ctx, key).Result()
		if err == nil {
			_ = s.Redis.Expire(ctx, key, 2*time.Minute).Err()
			if n > int64(account.RPMLimit) {
				_ = s.Redis.Decr(ctx, key).Err()
				return "", false
			}
		}
	}
	if account.ConcurrencyLimit <= 0 {
		return "", true
	}
	key := accountConcurrencyKey(account.ID)
	n, err := s.Redis.Incr(ctx, key).Result()
	if err != nil {
		return "", true
	}
	_ = s.Redis.Expire(ctx, key, 6*time.Hour).Err()
	if n > int64(account.ConcurrencyLimit) {
		_ = s.Redis.Decr(ctx, key).Err()
		return "", false
	}
	return key, true
}

func releaseAccountLease(s *store.Store, route *RouteResult) {
	if s == nil || s.Redis == nil || route == nil || route.AccountLeaseKey == "" {
		return
	}
	key := route.AccountLeaseKey
	route.AccountLeaseKey = ""
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = s.Redis.Decr(ctx, key).Err()
}

func switchUpstreamAccount(ctx context.Context, s *store.Store, route *RouteResult, exclude map[uint64]bool) bool {
	if route == nil || route.Upstream == nil || route.UpstreamAccount == nil {
		return false
	}
	releaseAccountLease(s, route)
	account, leaseKey, stickyKey, hasPool, err := selectUpstreamAccount(ctx, s, route.UserID, route.Upstream.ID, route.SessionID, exclude)
	if err != nil || !hasPool || account == nil {
		return false
	}
	route.UpstreamAccount = account
	route.UpstreamAPIKey = accountCredential(account)
	route.AccountLeaseKey = leaseKey
	route.StickyKey = stickyKey
	markAccountUsed(s, account.ID)
	return true
}

func accountRPMKey(id uint64) string {
	return fmt.Sprintf("relay:upstream-account:%d:rpm:%s", id, time.Now().Format("200601021504"))
}

func accountConcurrencyKey(id uint64) string {
	return fmt.Sprintf("relay:upstream-account:%d:concurrency", id)
}

func accountStickyKey(userID, upstreamID uint64, sessionID string) string {
	return fmt.Sprintf("relay:sticky:%d:%d:%s", userID, upstreamID, strings.TrimSpace(sessionID))
}

func accountCooldownKey(id uint64) string {
	return fmt.Sprintf("relay:upstream-account:%d:cooldown", id)
}

func accountCooling(ctx context.Context, s *store.Store, id uint64) bool {
	if s.Redis == nil || id == 0 {
		return false
	}
	n, err := s.Redis.Exists(ctx, accountCooldownKey(id)).Result()
	return err == nil && n > 0
}

func coolDownAccount(ctx context.Context, s *store.Store, account *store.UpstreamAccount, statusCode int, reason string) {
	if s == nil || account == nil || account.ID == 0 {
		return
	}
	ttl := accountCooldownTTL(statusCode)
	if ttl <= 0 {
		return
	}
	now := time.Now()
	_ = s.DB.Model(&store.UpstreamAccount{}).
		Where("id = ?", account.ID).
		Updates(map[string]any{
			"status":        "degraded",
			"last_check_at": now,
			"last_error":    truncate(reason, 512),
		}).Error
	if s.Redis != nil {
		if strings.TrimSpace(reason) == "" {
			reason = http.StatusText(statusCode)
		}
		_ = s.Redis.Set(ctx, accountCooldownKey(account.ID), truncate(reason, 512), ttl).Err()
	}
}

func accountCooldownTTL(statusCode int) time.Duration {
	switch {
	case statusCode == http.StatusTooManyRequests:
		return 2 * time.Minute
	case statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden:
		return 10 * time.Minute
	case statusCode == http.StatusRequestTimeout || statusCode == http.StatusBadGateway || statusCode == http.StatusServiceUnavailable || statusCode == http.StatusGatewayTimeout:
		return 45 * time.Second
	case statusCode == 0 || statusCode >= 500:
		return 45 * time.Second
	default:
		return 0
	}
}

func excludedAccount(id uint64, exclude map[uint64]bool) bool {
	return exclude != nil && exclude[id]
}

func markAccountUsed(s *store.Store, accountID uint64) {
	if accountID == 0 {
		return
	}
	now := time.Now()
	_ = s.DB.Model(&store.UpstreamAccount{}).
		Where("id = ?", accountID).
		UpdateColumn("last_used_at", now).Error
}

func accountCredential(account *store.UpstreamAccount) string {
	if account == nil {
		return ""
	}
	if strings.TrimSpace(account.OAuthAccessToken) != "" {
		return strings.TrimSpace(account.OAuthAccessToken)
	}
	return strings.TrimSpace(account.APIKey)
}

func extractSessionID(c *gin.Context, payload map[string]any) string {
	for _, key := range []string{"session_id", "x-session-id", "session-id", "X-Session-Id"} {
		if v := strings.TrimSpace(c.Request.Header.Get(key)); v != "" {
			return v
		}
	}
	for _, key := range []string{"session_id", "sessionId", "conversation_id", "conversationId"} {
		if v, ok := payload[key].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return strings.TrimSpace(c.Query("session_id"))
}

// parseReasoningEffort 从请求 body 推导思考强度字符串：
//   - OpenAI: `reasoning_effort` 字段 ("low"|"medium"|"high"|"minimal"|"xhigh")
//   - OpenAI Responses API: `reasoning.effort`
//   - Anthropic /v1/messages: `thinking.budget_tokens` → 按预算映射到 low/medium/high/max
//   - 都没有则返回 ""
func parseReasoningEffort(payload map[string]any) string {
	if s, ok := payload["reasoning_effort"].(string); ok && s != "" {
		return strings.ToLower(strings.TrimSpace(s))
	}
	if obj, ok := payload["reasoning"].(map[string]any); ok {
		if s, ok := obj["effort"].(string); ok && s != "" {
			return strings.ToLower(strings.TrimSpace(s))
		}
	}
	if obj, ok := payload["thinking"].(map[string]any); ok {
		typ, _ := obj["type"].(string)
		if typ != "" && typ != "enabled" {
			return ""
		}
		budget := 0
		if v, ok := obj["budget_tokens"].(float64); ok {
			budget = int(v)
		}
		switch {
		case budget <= 0:
			return ""
		case budget <= 2000:
			return "low"
		case budget <= 8000:
			return "medium"
		case budget <= 24000:
			return "high"
		default:
			return "max"
		}
	}
	return ""
}

// ensureIncludeUsage 给 OpenAI 流式请求强制开启 usage 统计。
func ensureIncludeUsage(payload map[string]any) {
	opts, _ := payload["stream_options"].(map[string]any)
	if opts == nil {
		opts = map[string]any{}
	}
	if _, ok := opts["include_usage"]; !ok {
		opts["include_usage"] = true
	}
	payload["stream_options"] = opts
}

// groupAllowed: 允许列表为空 → 全放；否则按 CSV 匹配 group.Name。
func groupAllowed(allowed, groupName string) bool {
	allowed = strings.TrimSpace(allowed)
	if allowed == "" {
		return true
	}
	for _, raw := range strings.Split(allowed, ",") {
		if strings.EqualFold(strings.TrimSpace(raw), groupName) {
			return true
		}
	}
	return false
}

// itoa 避免 fmt 依赖；小整数足够。
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
