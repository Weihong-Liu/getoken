package relay

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/puppet/getoken/server/internal/billing"
	"github.com/puppet/getoken/server/internal/config"
	"github.com/puppet/getoken/server/internal/store"
)

// Forward 主转发：把 c.Request 发到上游，按 proto 解析 usage 后结算。
//
// 设计取舍：
//   - 不用 httputil.ReverseProxy，因为 SSE 拷贝 + body 抓取 + 错误处理混在一起，
//     直接用 http.Client 流式 io.Copy 更可控。
//   - 流式 (text/event-stream)：边转发边 tee 到 buffer，结束时解析 usage。
//   - 非流式：先把整个上游 body 读到内存，解析 usage 后再 c.Writer.Write。
func Forward(c *gin.Context, cfg *config.Config, s *store.Store, log *zap.Logger,
	route *RouteResult, proto protocol, settle *SettleCtx) {

	target := buildTargetURL(route.Upstream.BaseURL, c.Request.URL)
	req, err := http.NewRequestWithContext(c.Request.Context(), c.Request.Method, target, bytes.NewReader(route.OriginalBody))
	if err != nil {
		settle.Release(s, log)
		settle.Finalize(c, s, log, billing.Tokens{}, 0, false, http.StatusBadGateway, "build request failed: "+err.Error())
		writeRelayError(c, http.StatusBadGateway, "api_error", "request_build_failed", err.Error())
		return
	}
	copyHeaders(c.Request.Header, req.Header)
	rewriteAuthHeaders(req, route.Upstream, proto)
	// Host 头由 net/http 重写。
	req.Header.Del("Host")

	client := &http.Client{
		Timeout: 0, // 不要总超时；ctx 已经控制。
		Transport: &http.Transport{
			Proxy:                 http.ProxyFromEnvironment,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			DisableCompression:    true, // SSE 必须；非流式也无害。
			ResponseHeaderTimeout: 5 * time.Minute,
			ForceAttemptHTTP2:     true,
		},
	}

	resp, err := client.Do(req)
	if err != nil {
		// 网络错误：退预扣、写错误 log。
		settle.Release(s, log)
		if errors.Is(err, context.Canceled) {
			settle.Finalize(c, s, log, billing.Tokens{}, 0, false, 499, "client cancelled")
			return
		}
		settle.Finalize(c, s, log, billing.Tokens{}, 0, false, http.StatusBadGateway, err.Error())
		writeRelayError(c, http.StatusBadGateway, "api_error", "upstream_unreachable", err.Error())
		return
	}
	defer resp.Body.Close()

	// 复制响应头（去掉 hop-by-hop）。
	for k, v := range resp.Header {
		if isHopHeader(k) {
			continue
		}
		for _, vv := range v {
			c.Writer.Header().Add(k, vv)
		}
	}
	c.Writer.WriteHeader(resp.StatusCode)

	contentType := resp.Header.Get("Content-Type")
	isSSE := looksLikeSSE(contentType)

	// 错误状态：把 body 透传给客户端 + 退预扣 + 记 error log。
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		_, _ = c.Writer.Write(body)
		settle.Release(s, log)
		settle.Finalize(c, s, log, billing.Tokens{}, 0, false, resp.StatusCode, truncate(string(body), 512))
		return
	}

	if isSSE || route.Stream {
		// 流式：边写边收集。
		handleStream(c, resp.Body, s, log, settle, proto)
		return
	}

	// 非流式：抓 body 解析 usage 再写。
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		settle.Release(s, log)
		settle.Finalize(c, s, log, billing.Tokens{}, 0, false, http.StatusBadGateway, "read upstream body failed: "+err.Error())
		// 头已经发出，只能截断写。
		return
	}
	_, _ = c.Writer.Write(body)

	usage, reasoning, ok := parseUsage(proto, body, false)
	if !ok {
		// 拿不到 usage：上游可能是非标准实现，退预扣并写一条 error log。
		settle.Release(s, log)
		settle.Finalize(c, s, log, billing.Tokens{}, 0, false, resp.StatusCode, "usage missing in response")
		return
	}
	settle.Finalize(c, s, log, usage, reasoning, true, resp.StatusCode, "")
}

// handleStream：把上游 SSE 实时转发给客户端，并把 raw bytes tee 到 buffer 留作 usage 解析。
func handleStream(c *gin.Context, body io.Reader, s *store.Store, log *zap.Logger, settle *SettleCtx, proto protocol) {
	flusher, _ := c.Writer.(http.Flusher)
	buf := &bytes.Buffer{}

	// 64KiB 已经足以容纳一条 SSE event；按读到就 flush。
	readBuf := make([]byte, 32*1024)
	for {
		n, readErr := body.Read(readBuf)
		if n > 0 {
			chunk := readBuf[:n]
			if _, err := c.Writer.Write(chunk); err != nil {
				// 客户端断开。
				log.Debug("relay client disconnect", zap.Error(err))
				break
			}
			buf.Write(chunk)
			if flusher != nil {
				flusher.Flush()
			}
		}
		if readErr != nil {
			if !errors.Is(readErr, io.EOF) {
				log.Debug("relay upstream stream error", zap.Error(readErr))
			}
			break
		}
	}

	usage, reasoning, ok := parseUsage(proto, buf.Bytes(), true)
	if !ok {
		settle.Release(s, log)
		settle.Finalize(c, s, log, billing.Tokens{}, 0, false, http.StatusOK, "usage missing in stream")
		return
	}
	settle.Finalize(c, s, log, usage, reasoning, true, http.StatusOK, "")
}

func parseUsage(proto protocol, body []byte, stream bool) (billing.Tokens, int, bool) {
	switch proto {
	case protoOpenAI:
		if stream {
			return parseOpenAIStreamUsage(body)
		}
		return parseOpenAIUsage(body)
	case protoAnthropic:
		if stream {
			return parseAnthropicStreamUsage(body)
		}
		return parseAnthropicUsage(body)
	}
	return billing.Tokens{}, 0, false
}

// buildTargetURL：约定 upstream.BaseURL 末尾不带 /v1；直接拼 originalPath。
// 同时把 c.Request.URL.RawQuery 透传过去。
func buildTargetURL(baseURL string, u *url.URL) string {
	base := strings.TrimRight(baseURL, "/")
	target := base + u.Path
	if u.RawQuery != "" {
		target += "?" + u.RawQuery
	}
	return target
}

// rewriteAuthHeaders：清掉来源端的鉴权，按 protocol 注入上游 key。
func rewriteAuthHeaders(req *http.Request, upstream *store.Upstream, proto protocol) {
	req.Header.Del("Authorization")
	req.Header.Del("x-api-key")
	switch proto {
	case protoAnthropic:
		req.Header.Set("x-api-key", upstream.APIKey)
		if req.Header.Get("anthropic-version") == "" {
			req.Header.Set("anthropic-version", "2023-06-01")
		}
	default:
		req.Header.Set("Authorization", "Bearer "+upstream.APIKey)
	}
}

func copyHeaders(src, dst http.Header) {
	for k, vs := range src {
		if isHopHeader(k) {
			continue
		}
		// Authorization / x-api-key 走 rewriteAuthHeaders 处理，这里先复制其它。
		if strings.EqualFold(k, "Authorization") || strings.EqualFold(k, "x-api-key") {
			continue
		}
		for _, v := range vs {
			dst.Add(k, v)
		}
	}
}

// hop-by-hop headers per RFC 7230 + a few quirks (Host 我们让 net/http 重写)。
func isHopHeader(k string) bool {
	switch strings.ToLower(k) {
	case "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
		"te", "trailer", "transfer-encoding", "upgrade", "host", "content-length":
		return true
	}
	return false
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "...(truncated)"
}

