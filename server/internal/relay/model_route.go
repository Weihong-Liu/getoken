package relay

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/puppet/getoken/server/internal/store"
)

const maxBodyBytes = 10 << 20 // 10 MiB

// RouteResult 聚合一次请求计费 / 转发所需的全部上下文。
type RouteResult struct {
	Model           *store.ModelMapping
	Upstream        *store.Upstream
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
	}

	reasoningEffort := parseReasoningEffort(payload)

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
		Model:           &mapping,
		Upstream:        &upstream,
		Group:           &grp,
		OriginalBody:    newBody,
		RawBody:         raw,
		ModelName:       modelName,
		Stream:          stream,
		MaxTokens:       maxTokens,
		ReasoningEffort: reasoningEffort,
	}, nil
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
