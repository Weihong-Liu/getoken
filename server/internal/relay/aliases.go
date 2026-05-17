package relay

import "github.com/gin-gonic/gin"

func (h *Handler) RegisterAliases(rg *gin.RouterGroup) {
	auth := TokenAuth(h.cfg, h.s)
	rg.POST("/responses", auth, h.proxyResponsesAlias("/v1/responses"))
	rg.POST("/responses/compact", auth, h.proxyResponsesAlias("/v1/responses"))
	rg.POST("/backend-api/codex/responses", auth, h.proxyResponsesAlias("/v1/responses"))
	rg.POST("/backend-api/codex/responses/:action", auth, h.proxyResponsesAlias("/v1/responses"))
}

func (h *Handler) RegisterAntigravity(rg *gin.RouterGroup) {
	auth := TokenAuth(h.cfg, h.s)
	rg.POST("/v1/messages", auth, h.proxyAnthropicAlias("/v1/messages"))
	rg.POST("/v1beta/models/:modelAction", auth, h.proxyGeminiAlias("/v1beta/models/"+":modelAction"))
}

func (h *Handler) proxyResponsesAlias(targetPath string) gin.HandlerFunc {
	next := h.proxy(protoOpenAI)
	return func(c *gin.Context) {
		c.Request.URL.Path = targetPath
		if c.Request.URL.RawPath != "" {
			c.Request.URL.RawPath = ""
		}
		c.Request.RequestURI = ""
		next(c)
	}
}

func (h *Handler) proxyAnthropicAlias(targetPath string) gin.HandlerFunc {
	next := h.proxy(protoAnthropic)
	return rewritePathAndProxy(targetPath, next)
}

func (h *Handler) proxyGeminiAlias(targetPath string) gin.HandlerFunc {
	next := h.proxyGemini()
	return rewritePathAndProxy(targetPath, next)
}

func rewritePathAndProxy(targetPath string, next gin.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.URL.Path = targetPath
		if c.Request.URL.RawPath != "" {
			c.Request.URL.RawPath = ""
		}
		c.Request.RequestURI = ""
		next(c)
	}
}
