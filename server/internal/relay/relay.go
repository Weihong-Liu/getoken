// Package relay 实现 /v1/* 的 LLM 网关层：
//
//	鉴权 (sk-getoken-*) → 模型路由 → 预扣 → 透传到上游 → 解析真实 usage →
//	结算 → 写 logs → 触发邀请人返利。
//
// 仅覆盖 OpenAI 兼容协议 (chat/completions, completions, embeddings) 与
// Anthropic Messages (/v1/messages)。其它路径走 catch-all 透传，不计费。
package relay

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/puppet/getoken/server/internal/config"
	"github.com/puppet/getoken/server/internal/store"
)

// Handler 把整个 /v1 子树挂上来。
type Handler struct {
	cfg *config.Config
	s   *store.Store
	log *zap.Logger
}

// NewHandler 构造 relay 入口。
func NewHandler(cfg *config.Config, s *store.Store, log *zap.Logger) *Handler {
	return &Handler{cfg: cfg, s: s, log: log}
}

// gin context keys for relay state.
const (
	ctxToken     = "relay.token"
	ctxUser      = "relay.user"
	ctxStartedAt = "relay.startedAt"
)

// protocol indicates which usage parser to apply.
type protocol int

const (
	protoOpenAI protocol = iota + 1
	protoAnthropic
)

// Register binds routes onto the supplied router group (mounted at /v1).
func (h *Handler) Register(rg *gin.RouterGroup) {
	auth := TokenAuth(h.cfg, h.s)

	rg.GET("/models", auth, h.listModels)

	rg.POST("/chat/completions", auth, h.proxy(protoOpenAI))
	rg.POST("/completions", auth, h.proxy(protoOpenAI))
	rg.POST("/embeddings", auth, h.proxy(protoOpenAI))

	rg.POST("/messages", auth, h.proxy(protoAnthropic))

	// 未识别路径走 NoRoute 兜底（在 server.go 里注册过则可注入；这里默认让 gin
	// 自带 404，避免「开放代理 + 安全风险」。明确不支持的路径返回 501，详见
	// forwardUnknown。
}

// proxy 是核心处理函数：拿到 token+user 后，解析模型路由 → 预扣 → 转发 → 结算。
func (h *Handler) proxy(proto protocol) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(ctxStartedAt, time.Now())

		tok := tokenFromCtx(c)
		usr := userFromCtx(c)
		if tok == nil || usr == nil {
			writeRelayError(c, http.StatusUnauthorized, "invalid_request_error", "missing_token", "missing token context")
			return
		}

		route, err := ResolveRoute(c, h.s, usr)
		if err != nil {
			writeRelayAppError(c, err)
			return
		}

		settle, err := PreCharge(c, h.s, h.log, usr, tok, route)
		if err != nil {
			writeRelayAppError(c, err)
			return
		}

		Forward(c, h.cfg, h.s, h.log, route, proto, settle)
	}
}
