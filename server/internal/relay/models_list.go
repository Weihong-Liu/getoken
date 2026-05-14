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

	var rows []store.ModelMapping
	if err := h.s.DB.Where("status = ?", "online").Order("model_id ASC").Find(&rows).Error; err != nil {
		writeRelayError(c, http.StatusInternalServerError, "api_error", "store_error", "could not list models")
		return
	}

	var grp store.Group
	if err := h.s.DB.First(&grp, usr.GroupID).Error; err != nil {
		grp.Name = "default"
	}

	type modelItem struct {
		ID      string `json:"id"`
		Object  string `json:"object"`
		Created int64  `json:"created"`
		OwnedBy string `json:"owned_by"`
	}
	items := make([]modelItem, 0, len(rows))
	for _, r := range rows {
		if !groupAllowed(r.AllowedGroups, grp.Name) {
			continue
		}
		owner := strings.TrimSpace(r.Vendor)
		if owner == "" {
			owner = "getoken"
		}
		items = append(items, modelItem{
			ID:      r.ModelID,
			Object:  "model",
			Created: r.CreatedAt.Unix(),
			OwnedBy: owner,
		})
	}
	c.JSON(http.StatusOK, gin.H{"object": "list", "data": items})
}
