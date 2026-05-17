package relay

import (
	"errors"
	"net/http"
	"strings"

	"gorm.io/gorm"

	"github.com/puppet/getoken/server/internal/store"
)

func userGroup(s *store.Store, user *store.User) store.Group {
	if user == nil {
		return store.Group{Name: "default"}
	}
	var grp store.Group
	if err := s.DB.First(&grp, user.GroupID).Error; err != nil {
		return store.Group{ID: user.GroupID, Name: "default"}
	}
	return grp
}

func loadModelForUser(s *store.Store, user *store.User, modelName string) (*store.ModelMapping, store.Group, error) {
	modelName = strings.TrimPrefix(strings.TrimSpace(modelName), "models/")
	if modelName == "" {
		return nil, store.Group{}, newRelayErr(http.StatusBadRequest, "invalid_request_error", "missing_model", "model is required")
	}

	var mapping store.ModelMapping
	if err := s.DB.Where("model_id = ? AND status = ?", modelName, "online").First(&mapping).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, store.Group{}, newRelayErr(http.StatusNotFound, "invalid_request_error", "model_not_found", "model '"+modelName+"' is not available")
		}
		return nil, store.Group{}, newRelayErr(http.StatusInternalServerError, "api_error", "store_error", "could not load model mapping")
	}

	grp := userGroup(s, user)
	if !groupAllowed(mapping.AllowedGroups, grp.Name) {
		return nil, grp, newRelayErr(http.StatusForbidden, "invalid_request_error", "model_forbidden", "your group is not allowed to use this model")
	}
	return &mapping, grp, nil
}

func tokenAllowedModel(token *store.Token, modelName string) bool {
	if token == nil {
		return true
	}
	allowed := strings.TrimSpace(token.AllowedModels)
	if allowed == "" || allowed == "*" {
		return true
	}
	modelName = strings.TrimPrefix(strings.TrimSpace(modelName), "models/")
	for _, raw := range strings.FieldsFunc(allowed, func(r rune) bool {
		return r == ',' || r == '\n' || r == ';' || r == ' ' || r == '\t'
	}) {
		pattern := strings.TrimPrefix(strings.TrimSpace(raw), "models/")
		if pattern == "" {
			continue
		}
		if pattern == "*" || pattern == modelName {
			return true
		}
		if strings.HasSuffix(pattern, "*") && strings.HasPrefix(modelName, strings.TrimSuffix(pattern, "*")) {
			return true
		}
	}
	return false
}

func filterModelsForToken(rows []store.ModelMapping, token *store.Token) []store.ModelMapping {
	if token == nil || strings.TrimSpace(token.AllowedModels) == "" || strings.TrimSpace(token.AllowedModels) == "*" {
		return rows
	}
	out := make([]store.ModelMapping, 0, len(rows))
	for _, row := range rows {
		if tokenAllowedModel(token, row.ModelID) {
			out = append(out, row)
		}
	}
	return out
}

func visibleModelsForUser(s *store.Store, user *store.User) ([]store.ModelMapping, store.Group, error) {
	var rows []store.ModelMapping
	if err := s.DB.Where("status = ?", "online").Order("model_id ASC").Find(&rows).Error; err != nil {
		return nil, store.Group{}, newRelayErr(http.StatusInternalServerError, "api_error", "store_error", "could not list models")
	}
	grp := userGroup(s, user)
	out := make([]store.ModelMapping, 0, len(rows))
	for _, row := range rows {
		if groupAllowed(row.AllowedGroups, grp.Name) {
			out = append(out, row)
		}
	}
	return out, grp, nil
}
