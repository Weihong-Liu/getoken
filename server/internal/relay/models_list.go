package relay

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/puppet/getoken/server/internal/store"
)

// listModels 返回 OpenAI 兼容的模型列表。
// 仅暴露 status='online' 的 model_mappings；若 user 所属 group 不在
// allowed_groups 列表中，则过滤掉。
func (h *Handler) listModels(c *gin.Context) {
	usr := userFromCtx(c)
	if usr == nil {
		writeRelayError(c, http.StatusUnauthorized, "invalid_request_error", "missing_token", "missing token context")
		return
	}
	tok := tokenFromCtx(c)

	rows, _, err := visibleModelsForUser(h.s, usr)
	if err != nil {
		writeRelayAppError(c, err)
		return
	}
	rows = filterModelsForToken(rows, tok)

	items := make([]modelItem, 0, len(rows))
	for _, r := range rows {
		items = append(items, openAIModelItem(r))
	}
	c.JSON(http.StatusOK, gin.H{"object": "list", "data": items})
}

func (h *Handler) getModel(c *gin.Context) {
	usr := userFromCtx(c)
	if usr == nil {
		writeRelayError(c, http.StatusUnauthorized, "invalid_request_error", "missing_token", "missing token context")
		return
	}
	tok := tokenFromCtx(c)
	model, _, err := loadModelForUser(h.s, usr, c.Param("model"))
	if err != nil {
		writeRelayAppError(c, err)
		return
	}
	if !tokenAllowedModel(tok, model.ModelID) {
		writeRelayError(c, http.StatusForbidden, "invalid_request_error", "token_model_forbidden", "API key is not allowed to use this model")
		return
	}
	c.JSON(http.StatusOK, openAIModelItem(*model))
}

func (h *Handler) listGeminiModels(c *gin.Context) {
	usr := userFromCtx(c)
	if usr == nil {
		writeRelayError(c, http.StatusUnauthorized, "invalid_request_error", "missing_token", "missing token context")
		return
	}
	tok := tokenFromCtx(c)
	rows, _, err := visibleModelsForUser(h.s, usr)
	if err != nil {
		writeRelayAppError(c, err)
		return
	}
	rows = filterModelsForToken(rows, tok)
	items := make([]gin.H, 0, len(rows))
	for _, row := range rows {
		if isGeminiModel(row) {
			items = append(items, geminiModelItem(row))
		}
	}
	c.JSON(http.StatusOK, gin.H{"models": items})
}

func (h *Handler) getGeminiModel(c *gin.Context) {
	usr := userFromCtx(c)
	if usr == nil {
		writeRelayError(c, http.StatusUnauthorized, "invalid_request_error", "missing_token", "missing token context")
		return
	}
	tok := tokenFromCtx(c)
	model, _, err := loadModelForUser(h.s, usr, c.Param("model"))
	if err != nil {
		writeRelayAppError(c, err)
		return
	}
	if !tokenAllowedModel(tok, model.ModelID) {
		writeRelayError(c, http.StatusForbidden, "invalid_request_error", "token_model_forbidden", "API key is not allowed to use this model")
		return
	}
	if !isGeminiModel(*model) {
		writeRelayError(c, http.StatusNotFound, "invalid_request_error", "model_not_found", "model '"+model.ModelID+"' is not a Gemini model")
		return
	}
	c.JSON(http.StatusOK, geminiModelItem(*model))
}

type modelItem struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	OwnedBy string `json:"owned_by"`
}

func openAIModelItem(r store.ModelMapping) modelItem {
	owner := strings.TrimSpace(r.Vendor)
	if owner == "" {
		owner = "getoken"
	}
	return modelItem{
		ID:      r.ModelID,
		Object:  "model",
		Created: r.CreatedAt.Unix(),
		OwnedBy: owner,
	}
}

func isGeminiModel(r store.ModelMapping) bool {
	vendor := strings.ToLower(strings.TrimSpace(r.Vendor))
	return vendor == "google" || vendor == "gemini" || strings.HasPrefix(strings.ToLower(r.ModelID), "gemini-")
}

func geminiModelItem(r store.ModelMapping) gin.H {
	inputLimit := r.Context
	if inputLimit <= 0 {
		inputLimit = 1_048_576
	}
	return gin.H{
		"name":                       "models/" + r.ModelID,
		"version":                    r.ModelID,
		"displayName":                r.ModelID,
		"description":                "GeToken routed Gemini model",
		"inputTokenLimit":            inputLimit,
		"outputTokenLimit":           8192,
		"supportedGenerationMethods": []string{"generateContent", "streamGenerateContent"},
	}
}
