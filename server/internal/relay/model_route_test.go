package relay

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestExtractSessionIDPriority(t *testing.T) {
	gin.SetMode(gin.TestMode)

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions?session_id=query-session", nil)
	req.Header.Set("X-Session-Id", "header-session")
	c.Request = req

	got := extractSessionID(c, map[string]any{"session_id": "body-session"})
	if got != "header-session" {
		t.Fatalf("expected header session, got %q", got)
	}
}

func TestExtractSessionIDFallbacks(t *testing.T) {
	gin.SetMode(gin.TestMode)

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions?session_id=query-session", nil)

	got := extractSessionID(c, map[string]any{"conversationId": "body-session"})
	if got != "body-session" {
		t.Fatalf("expected body session, got %q", got)
	}

	got = extractSessionID(c, map[string]any{})
	if got != "query-session" {
		t.Fatalf("expected query session, got %q", got)
	}
}

func TestBuildTargetURLKeepsSingleV1(t *testing.T) {
	u := &url.URL{Path: "/v1/chat/completions", RawQuery: "trace=1"}

	got := buildTargetURL("https://upstream.example.com/v1", u)
	want := "https://upstream.example.com/v1/chat/completions?trace=1"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}

	got = buildTargetURL("https://upstream.example.com", u)
	want = "https://upstream.example.com/v1/chat/completions?trace=1"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}

	u = &url.URL{Path: "/v1beta/models/gemini-2.5-pro:generateContent", RawQuery: "alt=sse"}
	got = buildTargetURL("https://generativelanguage.googleapis.com/v1beta", u)
	want = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?alt=sse"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestGeminiPathHelpers(t *testing.T) {
	model, action := parseGeminiModelAction("gemini-2.5-pro:streamGenerateContent")
	if model != "gemini-2.5-pro" || action != "streamGenerateContent" {
		t.Fatalf("unexpected model/action: %q %q", model, action)
	}

	u := &url.URL{Path: "/v1beta/models/gemini-2.5-pro:streamGenerateContent", RawQuery: "key=sk-getoken-demo"}
	rewriteGeminiURL(u, "gemini-2.5-flash", "streamGenerateContent", true)
	if u.Path != "/v1beta/models/gemini-2.5-flash:streamGenerateContent" {
		t.Fatalf("unexpected path: %q", u.Path)
	}
	if u.Query().Get("key") != "" {
		t.Fatal("expected user key query to be stripped before upstream forwarding")
	}
	if u.Query().Get("alt") != "sse" {
		t.Fatalf("expected alt=sse, got %q", u.Query().Get("alt"))
	}
}

func TestGinCapturesGeminiModelAction(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/v1beta/models/:modelAction", func(c *gin.Context) {
		c.String(http.StatusOK, c.Param("modelAction"))
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-2.5-pro:generateContent", nil)
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected route to match, got %d", rec.Code)
	}
	if rec.Body.String() != "gemini-2.5-pro:generateContent" {
		t.Fatalf("unexpected captured param: %q", rec.Body.String())
	}
}

func TestRetryAndCooldownStatus(t *testing.T) {
	retryable := []int{
		http.StatusUnauthorized,
		http.StatusForbidden,
		http.StatusRequestTimeout,
		http.StatusTooManyRequests,
		http.StatusBadGateway,
		http.StatusServiceUnavailable,
		http.StatusGatewayTimeout,
		http.StatusInternalServerError,
	}
	for _, status := range retryable {
		if !shouldRetryUpstreamStatus(status) {
			t.Fatalf("expected status %d to be retryable", status)
		}
		if accountCooldownTTL(status) <= 0 {
			t.Fatalf("expected status %d to have cooldown ttl", status)
		}
	}

	if shouldRetryUpstreamStatus(http.StatusBadRequest) {
		t.Fatal("expected 400 to be non-retryable")
	}
	if accountCooldownTTL(http.StatusBadRequest) != 0 {
		t.Fatal("expected 400 to have no cooldown ttl")
	}
	if accountCooldownTTL(http.StatusUnauthorized) <= accountCooldownTTL(http.StatusInternalServerError) {
		t.Fatal("expected auth failures to cool down longer than transient 5xx failures")
	}
	if accountCooldownTTL(http.StatusTooManyRequests) < time.Minute {
		t.Fatal("expected rate limits to cool down for at least one minute")
	}
}
