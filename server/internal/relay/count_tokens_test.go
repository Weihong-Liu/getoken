package relay

import "testing"

func TestEstimateCountTokensUsesRelevantPromptFields(t *testing.T) {
	payload := map[string]any{
		"model":      "claude-sonnet-4-6",
		"max_tokens": float64(8192),
		"messages": []any{
			map[string]any{"role": "user", "content": "你好, summarize this request."},
		},
	}
	got := estimateCountTokens([]byte(`{"model":"claude-sonnet-4-6","max_tokens":8192}`), payload)
	if got <= 0 {
		t.Fatalf("estimateCountTokens = %d, want positive", got)
	}
	if got > 80 {
		t.Fatalf("estimateCountTokens = %d, unexpectedly counted non-prompt fields", got)
	}
}

func TestParseUsageWindow(t *testing.T) {
	if got := parseUsageWindow("7d", "30"); got != 7 {
		t.Fatalf("parseUsageWindow first valid = %d, want 7", got)
	}
	if got := parseUsageWindow("bad", "91", ""); got != 30 {
		t.Fatalf("parseUsageWindow default = %d, want 30", got)
	}
}
