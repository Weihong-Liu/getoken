package relay

import (
	"bufio"
	"bytes"
	"encoding/json"

	"github.com/puppet/getoken/server/internal/billing"
)

type geminiUsage struct {
	PromptTokenCount        int `json:"promptTokenCount"`
	CandidatesTokenCount    int `json:"candidatesTokenCount"`
	TotalTokenCount         int `json:"totalTokenCount"`
	CachedContentTokenCount int `json:"cachedContentTokenCount"`
	ThoughtsTokenCount      int `json:"thoughtsTokenCount"`
}

func (u geminiUsage) toBilling() (billing.Tokens, int) {
	input := u.PromptTokenCount - u.CachedContentTokenCount
	if input < 0 {
		input = 0
	}
	output := u.CandidatesTokenCount
	if output == 0 && u.TotalTokenCount > u.PromptTokenCount {
		output = u.TotalTokenCount - u.PromptTokenCount
	}
	return billing.Tokens{
		Input:       input,
		Output:      output,
		CachedInput: u.CachedContentTokenCount,
	}, u.ThoughtsTokenCount
}

func parseGeminiUsage(body []byte) (billing.Tokens, int, bool) {
	var resp struct {
		UsageMetadata *geminiUsage `json:"usageMetadata"`
	}
	if err := json.Unmarshal(body, &resp); err == nil && resp.UsageMetadata != nil {
		tokens, reasoning := resp.UsageMetadata.toBilling()
		return tokens, reasoning, true
	}

	var rows []struct {
		UsageMetadata *geminiUsage `json:"usageMetadata"`
	}
	if err := json.Unmarshal(body, &rows); err != nil {
		return billing.Tokens{}, 0, false
	}
	for i := len(rows) - 1; i >= 0; i-- {
		if rows[i].UsageMetadata != nil {
			tokens, reasoning := rows[i].UsageMetadata.toBilling()
			return tokens, reasoning, true
		}
	}
	return billing.Tokens{}, 0, false
}

func parseGeminiStreamUsage(body []byte) (billing.Tokens, int, bool) {
	if tokens, reasoning, ok := parseGeminiUsage(body); ok {
		return tokens, reasoning, true
	}

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
		var chunk struct {
			UsageMetadata *geminiUsage `json:"usageMetadata"`
		}
		if err := json.Unmarshal(payload, &chunk); err != nil || chunk.UsageMetadata == nil {
			continue
		}
		last, lastReasoning = chunk.UsageMetadata.toBilling()
		found = true
	}
	return last, lastReasoning, found
}
