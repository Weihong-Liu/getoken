package relay

import "testing"

func TestParseOpenAIUsageResponsesShape(t *testing.T) {
	body := []byte(`{
		"id": "resp_123",
		"object": "response",
		"usage": {
			"input_tokens": 1200,
			"output_tokens": 300,
			"input_tokens_details": { "cached_tokens": 200 },
			"output_tokens_details": { "reasoning_tokens": 42 }
		}
	}`)

	tokens, reasoning, ok := parseOpenAIUsage(body)
	if !ok {
		t.Fatal("expected usage to parse")
	}
	if tokens.Input != 1000 || tokens.CachedInput != 200 || tokens.Output != 300 {
		t.Fatalf("tokens = %+v, want input=1000 cached=200 output=300", tokens)
	}
	if reasoning != 42 {
		t.Fatalf("reasoning = %d, want 42", reasoning)
	}
}

func TestParseOpenAIStreamUsageResponsesCompletedEvent(t *testing.T) {
	body := []byte("event: response.output_text.delta\n" +
		"data: {\"type\":\"response.output_text.delta\",\"delta\":\"hi\"}\n\n" +
		"event: response.completed\n" +
		"data: {\"type\":\"response.completed\",\"response\":{\"usage\":{\"input_tokens\":20,\"output_tokens\":7,\"input_tokens_details\":{\"cached_tokens\":5}}}}\n\n")

	tokens, reasoning, ok := parseOpenAIStreamUsage(body)
	if !ok {
		t.Fatal("expected stream usage to parse")
	}
	if tokens.Input != 15 || tokens.CachedInput != 5 || tokens.Output != 7 {
		t.Fatalf("tokens = %+v, want input=15 cached=5 output=7", tokens)
	}
	if reasoning != 0 {
		t.Fatalf("reasoning = %d, want 0", reasoning)
	}
}
