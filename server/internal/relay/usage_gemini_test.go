package relay

import "testing"

func TestParseGeminiUsage(t *testing.T) {
	body := []byte(`{
		"candidates": [],
		"usageMetadata": {
			"promptTokenCount": 120,
			"cachedContentTokenCount": 20,
			"candidatesTokenCount": 45,
			"totalTokenCount": 165,
			"thoughtsTokenCount": 7
		}
	}`)
	tokens, reasoning, ok := parseGeminiUsage(body)
	if !ok {
		t.Fatal("expected usage to be parsed")
	}
	if tokens.Input != 100 || tokens.CachedInput != 20 || tokens.Output != 45 || reasoning != 7 {
		t.Fatalf("unexpected usage: %+v reasoning=%d", tokens, reasoning)
	}
}

func TestParseGeminiStreamUsage(t *testing.T) {
	body := []byte(`data: {"candidates":[]}

data: {"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":5,"totalTokenCount":15}}

`)
	tokens, _, ok := parseGeminiStreamUsage(body)
	if !ok {
		t.Fatal("expected stream usage to be parsed")
	}
	if tokens.Input != 10 || tokens.Output != 5 {
		t.Fatalf("unexpected usage: %+v", tokens)
	}
}
