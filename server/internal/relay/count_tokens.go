package relay

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func (h *Handler) countAnthropicTokens(c *gin.Context) {
	usr := userFromCtx(c)
	if usr == nil {
		writeRelayError(c, http.StatusUnauthorized, "invalid_request_error", "missing_token", "missing token context")
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBodyBytes)
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			writeRelayError(c, http.StatusRequestEntityTooLarge, "invalid_request_error", "payload_too_large", "request body exceeds 10MiB")
			return
		}
		writeRelayError(c, http.StatusBadRequest, "invalid_request_error", "body_read_failed", "could not read request body: "+err.Error())
		return
	}
	_ = c.Request.Body.Close()

	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		writeRelayError(c, http.StatusBadRequest, "invalid_request_error", "invalid_json", "request body is not valid JSON: "+err.Error())
		return
	}

	modelName, _ := payload["model"].(string)
	if _, _, err := loadModelForUser(h.s, usr, modelName); err != nil {
		writeRelayAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"input_tokens": estimateCountTokens(raw, payload),
	})
}

func estimateCountTokens(raw []byte, payload map[string]any) int {
	relevant := map[string]any{}
	for _, key := range []string{"system", "messages", "tools", "tool_choice"} {
		if v, ok := payload[key]; ok {
			relevant[key] = v
		}
	}

	body := bytes.TrimSpace(raw)
	if len(relevant) > 0 {
		if b, err := json.Marshal(relevant); err == nil {
			body = b
		}
	}

	// Conservative local estimator: count JSON text and give CJK/punctuation a
	// bit more room than plain ASCII. Exact upstream count_tokens support can be
	// layered on later without changing this response contract.
	chars := 0
	nonASCII := 0
	for _, r := range strings.TrimSpace(string(body)) {
		chars++
		if r > 127 {
			nonASCII++
		}
	}
	tokens := (chars-nonASCII)/4 + nonASCII/2
	if nonASCII%2 != 0 {
		tokens++
	}
	if tokens < 1 {
		return 1
	}
	return tokens
}
