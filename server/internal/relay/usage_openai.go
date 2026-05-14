package relay

import (
	"bufio"
	"bytes"
	"encoding/json"
	"strings"

	"github.com/puppet/getoken/server/internal/billing"
)

// openaiUsage 是 OpenAI / OpenAI 兼容 API 的 usage 块。
type openaiUsage struct {
	PromptTokens        int `json:"prompt_tokens"`
	CompletionTokens    int `json:"completion_tokens"`
	TotalTokens         int `json:"total_tokens"`
	PromptTokensDetails struct {
		CachedTokens int `json:"cached_tokens"`
	} `json:"prompt_tokens_details"`
	CompletionTokensDetails struct {
		ReasoningTokens int `json:"reasoning_tokens"`
	} `json:"completion_tokens_details"`
}

func (u openaiUsage) toBilling() (billing.Tokens, int) {
	cached := u.PromptTokensDetails.CachedTokens
	in := u.PromptTokens - cached
	if in < 0 {
		in = 0
	}
	return billing.Tokens{
		Input:       in,
		Output:      u.CompletionTokens,
		CachedInput: cached,
	}, u.CompletionTokensDetails.ReasoningTokens
}

// parseOpenAIUsage：JSON 响应里挖 usage。第二个返回值是 reasoning_tokens（推理思考 token 数）。
func parseOpenAIUsage(body []byte) (billing.Tokens, int, bool) {
	var resp struct {
		Usage *openaiUsage `json:"usage"`
	}
	if err := json.Unmarshal(body, &resp); err != nil || resp.Usage == nil {
		return billing.Tokens{}, 0, false
	}
	tokens, rt := resp.Usage.toBilling()
	return tokens, rt, true
}

// parseOpenAIStreamUsage：扫描 SSE 流，找最后一个含 usage 的 chunk。
func parseOpenAIStreamUsage(body []byte) (billing.Tokens, int, bool) {
	scanner := bufio.NewScanner(bytes.NewReader(body))
	scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)
	var last billing.Tokens
	var lastReasoning int
	found := false
	for scanner.Scan() {
		line := scanner.Bytes()
		if !bytes.HasPrefix(line, []byte("data:")) {
			continue
		}
		payload := bytes.TrimSpace(line[len("data:"):])
		if len(payload) == 0 {
			continue
		}
		if bytes.Equal(payload, []byte("[DONE]")) {
			continue
		}
		var chunk struct {
			Usage *openaiUsage `json:"usage"`
		}
		if err := json.Unmarshal(payload, &chunk); err != nil {
			continue
		}
		if chunk.Usage == nil {
			continue
		}
		// 一些供应商在每个增量里都带 usage，留最后一个就行。
		last, lastReasoning = chunk.Usage.toBilling()
		found = true
	}
	return last, lastReasoning, found
}

// looksLikeSSE 判断响应是不是 event-stream。
func looksLikeSSE(contentType string) bool {
	return strings.Contains(strings.ToLower(contentType), "text/event-stream")
}
