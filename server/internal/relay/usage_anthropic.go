package relay

import (
	"bufio"
	"bytes"
	"encoding/json"

	"github.com/puppet/getoken/server/internal/billing"
)

// anthropicUsage 对应 /v1/messages 响应里的 usage 块。
type anthropicUsage struct {
	InputTokens              int `json:"input_tokens"`
	OutputTokens             int `json:"output_tokens"`
	CacheReadInputTokens     int `json:"cache_read_input_tokens"`
	CacheCreationInputTokens int `json:"cache_creation_input_tokens"`
}

func (u anthropicUsage) toBilling() billing.Tokens {
	in := u.InputTokens - u.CacheReadInputTokens
	if in < 0 {
		in = 0
	}
	return billing.Tokens{
		Input:         in,
		Output:        u.OutputTokens,
		CachedInput:   u.CacheReadInputTokens,
		CacheCreation: u.CacheCreationInputTokens,
	}
}

// parseAnthropicUsage：非流式 JSON 响应。
// Anthropic 把 extended-thinking 的思考 token 计入 output_tokens，
// 不暴露独立的 reasoning_tokens 字段，所以这里第 2 个返回值固定 0。
func parseAnthropicUsage(body []byte) (billing.Tokens, int, bool) {
	var resp struct {
		Usage *anthropicUsage `json:"usage"`
	}
	if err := json.Unmarshal(body, &resp); err != nil || resp.Usage == nil {
		return billing.Tokens{}, 0, false
	}
	return resp.Usage.toBilling(), 0, true
}

// parseAnthropicStreamUsage：解析 SSE。
//
// Anthropic 流式分多种事件：
//
//	message_start: { message: { usage: { input_tokens, cache_*_input_tokens } } }
//	message_delta: { usage: { output_tokens, input_tokens? } }
//
// 我们累计 input 维度 (message_start 已经包含所有 input/cache)，
// output_tokens 在 message_delta 里增量给出（API 文档说是当前累计值，不是 delta），
// 所以取最后一次即可。
func parseAnthropicStreamUsage(body []byte) (billing.Tokens, int, bool) {
	scanner := bufio.NewScanner(bytes.NewReader(body))
	scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)

	var inputU anthropicUsage
	var lastOutput int
	gotStart := false
	gotDelta := false

	for scanner.Scan() {
		line := scanner.Bytes()
		if !bytes.HasPrefix(line, []byte("data:")) {
			continue
		}
		payload := bytes.TrimSpace(line[len("data:"):])
		if len(payload) == 0 {
			continue
		}

		var head struct {
			Type    string `json:"type"`
			Message struct {
				Usage *anthropicUsage `json:"usage"`
			} `json:"message"`
			Usage *anthropicUsage `json:"usage"`
		}
		if err := json.Unmarshal(payload, &head); err != nil {
			continue
		}
		switch head.Type {
		case "message_start":
			if head.Message.Usage != nil {
				inputU = *head.Message.Usage
				gotStart = true
				if head.Message.Usage.OutputTokens > 0 {
					lastOutput = head.Message.Usage.OutputTokens
				}
			}
		case "message_delta":
			if head.Usage != nil {
				gotDelta = true
				if head.Usage.OutputTokens > 0 {
					lastOutput = head.Usage.OutputTokens
				}
				// 某些实现 message_delta 也会带 input_tokens（rare），保留最新值。
				if head.Usage.InputTokens > 0 {
					inputU.InputTokens = head.Usage.InputTokens
				}
				if head.Usage.CacheReadInputTokens > 0 {
					inputU.CacheReadInputTokens = head.Usage.CacheReadInputTokens
				}
				if head.Usage.CacheCreationInputTokens > 0 {
					inputU.CacheCreationInputTokens = head.Usage.CacheCreationInputTokens
				}
			}
		}
	}
	if !gotStart && !gotDelta {
		return billing.Tokens{}, 0, false
	}
	inputU.OutputTokens = lastOutput
	return inputU.toBilling(), 0, true
}
