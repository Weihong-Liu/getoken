package admin

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"github.com/puppet/getoken/server/internal/audit"
	"github.com/puppet/getoken/server/internal/billing"
	"github.com/puppet/getoken/server/internal/middleware"
	"github.com/puppet/getoken/server/internal/pkg/errkit"
	"github.com/puppet/getoken/server/internal/pkg/idgen"
	"github.com/puppet/getoken/server/internal/pkg/paginate"
	"github.com/puppet/getoken/server/internal/response"
	"github.com/puppet/getoken/server/internal/store"
)

type Handler struct {
	s   *store.Store
	log *zap.Logger
}

func NewHandler(s *store.Store, log *zap.Logger) *Handler { return &Handler{s: s, log: log} }

func (h *Handler) emitAudit(c *gin.Context, action, target string, detail any) {
	ev := audit.Event{Action: action, Target: target, Detail: detail, IP: c.ClientIP()}
	if u := middleware.CurrentUser(c); u != nil {
		ev.ActorID = u.ID
	}
	audit.Emit(h.s.DB, h.log, ev)
}

func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/users", h.listUsers)
	rg.POST("/users", h.createUser)
	rg.PUT("/users/:id", h.updateUser)
	rg.DELETE("/users/:id", h.deleteUser)

	rg.GET("/upstreams", h.listUpstreams)
	rg.POST("/upstreams", h.createUpstream)
	rg.POST("/upstreams/bulk-status", h.bulkUpdateUpstreams)
	rg.POST("/upstreams/:id/check", h.checkUpstream)
	rg.POST("/upstreams/:id/sync-models", h.syncUpstreamModels)
	rg.PUT("/upstreams/:id", h.updateUpstream)
	rg.DELETE("/upstreams/:id", h.deleteUpstream)
	rg.GET("/upstream-accounts", h.listUpstreamAccounts)
	rg.POST("/upstream-accounts", h.createUpstreamAccount)
	rg.PUT("/upstream-accounts/:id", h.updateUpstreamAccount)
	rg.DELETE("/upstream-accounts/:id", h.deleteUpstreamAccount)
	rg.POST("/upstream-accounts/:id/check", h.checkUpstreamAccount)
	rg.POST("/upstream-accounts/:id/recover", h.recoverUpstreamAccount)
	rg.POST("/upstream-accounts/:id/oauth/start", h.startUpstreamAccountOAuth)
	rg.POST("/upstream-accounts/:id/refresh-oauth", h.refreshUpstreamAccountOAuth)

	rg.GET("/ops/snapshot", h.opsSnapshot)
	rg.GET("/ops/accounts", h.opsAccounts)
	rg.GET("/ops/errors", h.opsErrors)

	rg.GET("/models", h.listModels)
	rg.POST("/models", h.createModel)
	rg.PUT("/models/:id", h.updateModel)
	rg.DELETE("/models/:id", h.deleteModel)
	rg.POST("/models/seed-defaults", h.seedModels)

	rg.GET("/groups", h.listGroups)
	rg.POST("/groups", h.createGroup)
	rg.PUT("/groups/:id", h.updateGroup)
	rg.DELETE("/groups/:id", h.deleteGroup)

	rg.GET("/redemption", h.listRedemption)
	rg.POST("/redemption", h.createRedemption)
	rg.GET("/redemption/export", h.exportRedemption)
	rg.DELETE("/redemption/:id", h.deleteRedemption)

	rg.GET("/announcements", h.listAnnouncements)
	rg.POST("/announcements", h.createAnnouncement)
	rg.PUT("/announcements/:id", h.updateAnnouncement)
	rg.DELETE("/announcements/:id", h.deleteAnnouncement)

	rg.GET("/settings", h.getSettings)
	rg.PUT("/settings", h.updateSettings)
}

// ---------- users ----------

func (h *Handler) listUsers(c *gin.Context) {
	page := paginate.FromQuery(c)
	q := h.s.DB.Model(&store.User{})
	if kw := strings.TrimSpace(c.Query("q")); kw != "" {
		like := "%" + kw + "%"
		q = q.Where("email ILIKE ? OR username ILIKE ?", like, like)
	}
	if role := c.Query("role"); role != "" {
		q = q.Where("role = ?", role)
	}
	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}
	var total int64
	q.Count(&total)
	var rows []store.User
	if err := page.Apply(q).Order("id DESC").Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	response.OK(c, response.Page[store.User]{Items: rows, Total: total, Page: page.Page, PageSize: page.PageSize})
}

type adminUserCreateReq struct {
	Email            string `json:"email" binding:"required,email"`
	Password         string `json:"password" binding:"required,min=6,max=64"`
	Username         string `json:"username"`
	Role             string `json:"role"`
	GroupID          uint64 `json:"groupId"`
	ConcurrencyLimit int    `json:"concurrencyLimit"`
	QPSLimit         int    `json:"qpsLimit"`
	TPSLimit         int    `json:"tpsLimit"`
	RPMLimit         int    `json:"rpmLimit"`
	TPMLimit         int    `json:"tpmLimit"`
}

func (h *Handler) createUser(c *gin.Context) {
	var req adminUserCreateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	if req.Role != "admin" {
		req.Role = "user"
	}
	if req.GroupID == 0 {
		req.GroupID = 1
	}
	username := req.Username
	if strings.TrimSpace(username) == "" {
		username = strings.SplitN(req.Email, "@", 2)[0]
	}
	u := store.User{
		Email:            strings.ToLower(strings.TrimSpace(req.Email)),
		PasswordHash:     string(hash),
		Username:         username,
		Role:             req.Role,
		Status:           "active",
		GroupID:          req.GroupID,
		ConcurrencyLimit: nonNegative(req.ConcurrencyLimit),
		QPSLimit:         nonNegative(req.QPSLimit),
		TPSLimit:         nonNegative(req.TPSLimit),
		RPMLimit:         nonNegative(req.RPMLimit),
		TPMLimit:         nonNegative(req.TPMLimit),
		InviteCode:       idgen.RandomAlpha(8),
	}
	if err := h.s.DB.Create(&u).Error; err != nil {
		response.Fail(c, errkit.Conflict("邮箱已存在"))
		return
	}
	h.emitAudit(c, "admin.user.create", fmt.Sprintf("user:%d", u.ID), gin.H{
		"email":   u.Email,
		"role":    u.Role,
		"groupId": u.GroupID,
	})
	response.Created(c, u)
}

type adminUserUpdateReq struct {
	Username         *string `json:"username"`
	Role             *string `json:"role"`
	Status           *string `json:"status"`
	GroupID          *uint64 `json:"groupId"`
	Quota            *string `json:"quota"`
	Password         *string `json:"password"`
	ConcurrencyLimit *int    `json:"concurrencyLimit"`
	QPSLimit         *int    `json:"qpsLimit"`
	TPSLimit         *int    `json:"tpsLimit"`
	RPMLimit         *int    `json:"rpmLimit"`
	TPMLimit         *int    `json:"tpmLimit"`
}

func (h *Handler) updateUser(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var u store.User
	if err := h.s.DB.First(&u, id).Error; err != nil {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	var req adminUserUpdateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	updates := map[string]any{}
	if req.Username != nil {
		updates["username"] = *req.Username
	}
	if req.Role != nil && (*req.Role == "user" || *req.Role == "admin") {
		updates["role"] = *req.Role
	}
	if req.Status != nil && (*req.Status == "active" || *req.Status == "banned") {
		updates["status"] = *req.Status
	}
	if req.GroupID != nil {
		updates["group_id"] = *req.GroupID
	}
	if req.ConcurrencyLimit != nil {
		updates["concurrency_limit"] = nonNegative(*req.ConcurrencyLimit)
	}
	if req.QPSLimit != nil {
		updates["qps_limit"] = nonNegative(*req.QPSLimit)
	}
	if req.TPSLimit != nil {
		updates["tps_limit"] = nonNegative(*req.TPSLimit)
	}
	if req.RPMLimit != nil {
		updates["rpm_limit"] = nonNegative(*req.RPMLimit)
	}
	if req.TPMLimit != nil {
		updates["tpm_limit"] = nonNegative(*req.TPMLimit)
	}
	if req.Quota != nil {
		q, err := decimal.NewFromString(*req.Quota)
		if err != nil {
			response.Fail(c, errkit.BadRequest("额度格式不正确"))
			return
		}
		updates["quota"] = q
	}
	if req.Password != nil && *req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err != nil {
			response.Fail(c, errkit.ErrInternal)
			return
		}
		updates["password_hash"] = string(hash)
	}
	if len(updates) > 0 {
		if err := h.s.DB.Model(&u).Updates(updates).Error; err != nil {
			response.Fail(c, errkit.ErrInternal)
			return
		}
	}
	h.s.DB.First(&u, id)
	h.emitAudit(c, "admin.user.update", fmt.Sprintf("user:%d", id), gin.H{"fields": updates})
	response.OK(c, u)
}

func (h *Handler) deleteUser(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	res := h.s.DB.Delete(&store.User{}, id)
	if res.Error != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.emitAudit(c, "admin.user.delete", fmt.Sprintf("user:%d", id), gin.H{"affected": res.RowsAffected})
	response.OK(c, gin.H{"ok": true, "affected": res.RowsAffected})
}

// ---------- upstreams ----------

func (h *Handler) listUpstreams(c *gin.Context) {
	var rows []store.Upstream
	if err := h.s.DB.Order("priority DESC, id ASC").Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	// Mask api_key so frontend can render w/o leaking
	type view struct {
		store.Upstream
		APIKeyMask string `json:"apiKeyMask"`
	}
	views := make([]view, len(rows))
	for i, r := range rows {
		views[i] = view{Upstream: r, APIKeyMask: maskSecret(r.APIKey)}
	}
	response.OK(c, views)
}

type upstreamReq struct {
	Name             string `json:"name" binding:"required,max=64"`
	Type             string `json:"type"`
	BaseURL          string `json:"baseUrl" binding:"required,url"`
	APIKey           string `json:"apiKey"`
	Status           string `json:"status"`
	Tags             string `json:"tags"`
	Priority         int    `json:"priority"`
	Weight           int    `json:"weight"`
	AutoDisable      *bool  `json:"autoDisable"`
	FailureThreshold int    `json:"failureThreshold"`
	Note             string `json:"note"`
}

func (h *Handler) createUpstream(c *gin.Context) {
	var req upstreamReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	u := store.Upstream{
		Name:             req.Name,
		Type:             orDefault(req.Type, "openai"),
		BaseURL:          req.BaseURL,
		APIKey:           req.APIKey,
		Status:           orDefault(req.Status, "online"),
		Tags:             req.Tags,
		Priority:         defaultInt(req.Priority, 10),
		Weight:           defaultInt(req.Weight, 10),
		AutoDisable:      boolDefault(req.AutoDisable, true),
		FailureThreshold: defaultInt(req.FailureThreshold, 3),
		Note:             req.Note,
	}
	if err := h.s.DB.Create(&u).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.emitAudit(c, "admin.upstream.create", fmt.Sprintf("upstream:%d", u.ID), gin.H{
		"name":    u.Name,
		"type":    u.Type,
		"baseUrl": u.BaseURL,
	})
	response.Created(c, u)
}

func (h *Handler) updateUpstream(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var u store.Upstream
	if err := h.s.DB.First(&u, id).Error; err != nil {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	var req upstreamReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	updates := map[string]any{
		"name":              req.Name,
		"type":              orDefault(req.Type, u.Type),
		"base_url":          req.BaseURL,
		"status":            orDefault(req.Status, u.Status),
		"tags":              req.Tags,
		"priority":          defaultInt(req.Priority, u.Priority),
		"weight":            defaultInt(req.Weight, u.Weight),
		"auto_disable":      boolDefault(req.AutoDisable, u.AutoDisable),
		"failure_threshold": defaultInt(req.FailureThreshold, u.FailureThreshold),
		"note":              req.Note,
	}
	if req.APIKey != "" {
		updates["api_key"] = req.APIKey
	}
	if err := h.s.DB.Model(&u).Updates(updates).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.s.DB.First(&u, id)
	auditUpdates := make(map[string]any, len(updates))
	for k, v := range updates {
		if k == "api_key" {
			auditUpdates[k] = "***"
		} else {
			auditUpdates[k] = v
		}
	}
	h.emitAudit(c, "admin.upstream.update", fmt.Sprintf("upstream:%d", id), auditUpdates)
	response.OK(c, u)
}

func (h *Handler) deleteUpstream(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	res := h.s.DB.Delete(&store.Upstream{}, id)
	if res.Error != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.emitAudit(c, "admin.upstream.delete", fmt.Sprintf("upstream:%d", id), nil)
	response.OK(c, gin.H{"ok": true})
}

// ---------- model mappings ----------

func (h *Handler) listModels(c *gin.Context) {
	var rows []store.ModelMapping
	if err := h.s.DB.Order("id ASC").Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	response.OK(c, rows)
}

type modelReq struct {
	ModelID            string `json:"modelId" binding:"required,max=96"`
	Vendor             string `json:"vendor"`
	UpstreamID         uint64 `json:"upstreamId" binding:"required"`
	UpstreamModelName  string `json:"upstreamModelName" binding:"required,max=96"`
	InputPrice         string `json:"inputPrice"`
	OutputPrice        string `json:"outputPrice"`
	CachedPrice        string `json:"cachedPrice"`
	CacheCreationPrice string `json:"cacheCreationPrice"`
	Context            int    `json:"context"`
	Status             string `json:"status"`
	AllowedGroups      string `json:"allowedGroups"`
}

func (h *Handler) createModel(c *gin.Context) {
	var req modelReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	in, err := parseRatio(req.InputPrice, "1")
	if err != nil {
		response.Fail(c, errkit.BadRequest("输入价格不合法"))
		return
	}
	out, err := parseRatio(req.OutputPrice, "1")
	if err != nil {
		response.Fail(c, errkit.BadRequest("输出价格不合法"))
		return
	}
	cached, err := parseRatio(req.CachedPrice, "0")
	if err != nil {
		response.Fail(c, errkit.BadRequest("缓存价格不合法"))
		return
	}
	cacheCreation, err := parseRatio(req.CacheCreationPrice, "0")
	if err != nil {
		response.Fail(c, errkit.BadRequest("写缓存价格不合法"))
		return
	}
	m := store.ModelMapping{
		ModelID:            req.ModelID,
		Vendor:             req.Vendor,
		UpstreamID:         req.UpstreamID,
		UpstreamModelName:  req.UpstreamModelName,
		InputPrice:         in,
		OutputPrice:        out,
		CachedPrice:        cached,
		CacheCreationPrice: cacheCreation,
		Context:            req.Context,
		Status:             orDefault(req.Status, "online"),
		AllowedGroups:      orDefault(req.AllowedGroups, "default"),
	}
	if err := h.s.DB.Create(&m).Error; err != nil {
		response.Fail(c, errkit.Conflict("模型 ID 已存在"))
		return
	}
	h.emitAudit(c, "admin.model.create", fmt.Sprintf("model:%d", m.ID), gin.H{
		"modelId":    m.ModelID,
		"upstreamId": m.UpstreamID,
	})
	response.Created(c, m)
}

func (h *Handler) updateModel(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var m store.ModelMapping
	if err := h.s.DB.First(&m, id).Error; err != nil {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	var req modelReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	in, err := parseRatio(req.InputPrice, m.InputPrice.String())
	if err != nil {
		response.Fail(c, errkit.BadRequest("输入价格不合法"))
		return
	}
	out, err := parseRatio(req.OutputPrice, m.OutputPrice.String())
	if err != nil {
		response.Fail(c, errkit.BadRequest("输出价格不合法"))
		return
	}
	cached, err := parseRatio(req.CachedPrice, m.CachedPrice.String())
	if err != nil {
		response.Fail(c, errkit.BadRequest("缓存价格不合法"))
		return
	}
	cacheCreation, err := parseRatio(req.CacheCreationPrice, m.CacheCreationPrice.String())
	if err != nil {
		response.Fail(c, errkit.BadRequest("写缓存价格不合法"))
		return
	}
	updates := map[string]any{
		"vendor":               req.Vendor,
		"upstream_id":          req.UpstreamID,
		"upstream_model_name":  req.UpstreamModelName,
		"input_price":          in,
		"output_price":         out,
		"cached_price":         cached,
		"cache_creation_price": cacheCreation,
		"context":              req.Context,
		"status":               orDefault(req.Status, m.Status),
		"allowed_groups":       orDefault(req.AllowedGroups, m.AllowedGroups),
	}
	if req.ModelID != "" && req.ModelID != m.ModelID {
		updates["model_id"] = req.ModelID
	}
	if err := h.s.DB.Model(&m).Updates(updates).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.s.DB.First(&m, id)
	h.emitAudit(c, "admin.model.update", fmt.Sprintf("model:%d", id), updates)
	response.OK(c, m)
}

func (h *Handler) deleteModel(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if err := h.s.DB.Delete(&store.ModelMapping{}, id).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.emitAudit(c, "admin.model.delete", fmt.Sprintf("model:%d", id), nil)
	response.OK(c, gin.H{"ok": true})
}

type seedModelsReq struct {
	UpstreamID uint64 `json:"upstreamId"`
	Overwrite  bool   `json:"overwrite"`
}

// seedModels 把 billing.DefaultModels 批量灌入 model_mappings。
//   - 不存在则创建（upstream_id 用入参）；upstreamId 为 0 时跳过并计入 skipped
//   - 存在 + overwrite=true：只刷价格/上下文/vendor，不动 upstream_id / allowed_groups
//   - 存在 + overwrite=false：跳过
func (h *Handler) seedModels(c *gin.Context) {
	var req seedModelsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}

	var created, updated, skipped int
	for _, d := range billing.DefaultModels {
		in, err := decimal.NewFromString(d.InputPrice)
		if err != nil {
			skipped++
			continue
		}
		out, err := decimal.NewFromString(d.OutputPrice)
		if err != nil {
			skipped++
			continue
		}
		cached := decimal.Zero
		if strings.TrimSpace(d.CachedPrice) != "" {
			if v, err := decimal.NewFromString(d.CachedPrice); err == nil {
				cached = v
			}
		}
		cacheCreation := decimal.Zero
		if strings.TrimSpace(d.CacheCreationPrice) != "" {
			if v, err := decimal.NewFromString(d.CacheCreationPrice); err == nil {
				cacheCreation = v
			}
		}

		var existing store.ModelMapping
		err = h.s.DB.Where("model_id = ?", d.ModelID).First(&existing).Error
		if err == nil {
			// 已存在
			if !req.Overwrite {
				skipped++
				continue
			}
			if err := h.s.DB.Model(&existing).Updates(map[string]any{
				"vendor":               d.Vendor,
				"input_price":          in,
				"output_price":         out,
				"cached_price":         cached,
				"cache_creation_price": cacheCreation,
				"context":              d.Context,
			}).Error; err != nil {
				skipped++
				continue
			}
			updated++
			continue
		}
		// 不存在 -> 需要 upstreamId
		if req.UpstreamID == 0 {
			skipped++
			continue
		}
		m := store.ModelMapping{
			ModelID:            d.ModelID,
			Vendor:             d.Vendor,
			UpstreamID:         req.UpstreamID,
			UpstreamModelName:  d.ModelID,
			InputPrice:         in,
			OutputPrice:        out,
			CachedPrice:        cached,
			CacheCreationPrice: cacheCreation,
			Context:            d.Context,
			Status:             "online",
			AllowedGroups:      "default",
		}
		if err := h.s.DB.Create(&m).Error; err != nil {
			skipped++
			continue
		}
		created++
	}

	h.emitAudit(c, "admin.model.seed", "", gin.H{
		"upstreamId": req.UpstreamID,
		"overwrite":  req.Overwrite,
		"created":    created,
		"updated":    updated,
		"skipped":    skipped,
	})
	response.OK(c, gin.H{
		"created": created,
		"updated": updated,
		"skipped": skipped,
	})
}

// ---------- groups ----------

func (h *Handler) listGroups(c *gin.Context) {
	var rows []store.Group
	if err := h.s.DB.Order("id ASC").Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	response.OK(c, rows)
}

type groupReq struct {
	Name  string `json:"name" binding:"required,max=64"`
	Ratio string `json:"ratio"`
	Note  string `json:"note"`
}

func (h *Handler) createGroup(c *gin.Context) {
	var req groupReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	ratio, err := parseRatio(req.Ratio, "1")
	if err != nil {
		response.Fail(c, errkit.BadRequest("倍率不合法"))
		return
	}
	g := store.Group{Name: req.Name, Ratio: ratio, Note: req.Note}
	if err := h.s.DB.Create(&g).Error; err != nil {
		response.Fail(c, errkit.Conflict("分组名已存在"))
		return
	}
	h.emitAudit(c, "admin.group.create", fmt.Sprintf("group:%d", g.ID), gin.H{
		"name":  g.Name,
		"ratio": g.Ratio,
	})
	response.Created(c, g)
}

func (h *Handler) updateGroup(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var g store.Group
	if err := h.s.DB.First(&g, id).Error; err != nil {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	var req groupReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	ratio, err := parseRatio(req.Ratio, g.Ratio.String())
	if err != nil {
		response.Fail(c, errkit.BadRequest("倍率不合法"))
		return
	}
	if err := h.s.DB.Model(&g).Updates(map[string]any{
		"name":  req.Name,
		"ratio": ratio,
		"note":  req.Note,
	}).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.s.DB.First(&g, id)
	h.emitAudit(c, "admin.group.update", fmt.Sprintf("group:%d", id), gin.H{
		"name":  req.Name,
		"ratio": ratio,
	})
	response.OK(c, g)
}

func (h *Handler) deleteGroup(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if id == 1 {
		response.Fail(c, errkit.BadRequest("默认分组不可删除"))
		return
	}
	if err := h.s.DB.Delete(&store.Group{}, id).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.emitAudit(c, "admin.group.delete", fmt.Sprintf("group:%d", id), nil)
	response.OK(c, gin.H{"ok": true})
}

// ---------- redemption ----------

func (h *Handler) listRedemption(c *gin.Context) {
	page := paginate.FromQuery(c)
	q := h.s.DB.Model(&store.RedemptionCode{})
	if v := c.Query("status"); v != "" {
		q = q.Where("status = ?", v)
	}
	if v := c.Query("batch"); v != "" {
		q = q.Where("batch_id = ?", v)
	}
	var total int64
	q.Count(&total)
	var rows []store.RedemptionCode
	if err := page.Apply(q).Order("id DESC").Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	response.OK(c, response.Page[store.RedemptionCode]{Items: rows, Total: total, Page: page.Page, PageSize: page.PageSize})
}

type redemptionCreateReq struct {
	Count  int    `json:"count" binding:"required,min=1,max=500"`
	Amount string `json:"amount" binding:"required"`
}

func (h *Handler) createRedemption(c *gin.Context) {
	var req redemptionCreateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	amount, err := decimal.NewFromString(req.Amount)
	if err != nil || amount.IsNegative() {
		response.Fail(c, errkit.BadRequest("金额不合法"))
		return
	}
	batch := idgen.RandomAlpha(8)
	rows := make([]store.RedemptionCode, 0, req.Count)
	for i := 0; i < req.Count; i++ {
		rows = append(rows, store.RedemptionCode{
			Code:    idgen.RedemptionCode(),
			Amount:  amount,
			Status:  "unused",
			BatchID: batch,
		})
	}
	if err := h.s.DB.Create(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.emitAudit(c, "admin.redemption.batch.create", "batch:"+batch, gin.H{
		"count":  req.Count,
		"amount": amount,
	})
	response.Created(c, gin.H{"batchId": batch, "count": len(rows), "codes": rows})
}

func (h *Handler) exportRedemption(c *gin.Context) {
	q := h.s.DB.Model(&store.RedemptionCode{})
	if v := c.Query("batch"); v != "" {
		q = q.Where("batch_id = ?", v)
	}
	if v := c.Query("status"); v != "" {
		q = q.Where("status = ?", v)
	}
	var rows []store.RedemptionCode
	if err := q.Order("id ASC").Limit(50000).Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	c.Writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
	c.Writer.Header().Set("Content-Disposition", `attachment; filename="redemption.csv"`)
	c.Writer.WriteHeader(http.StatusOK)
	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{"code", "amount", "status", "batch", "createdAt"})
	for _, r := range rows {
		_ = w.Write([]string{r.Code, r.Amount.String(), r.Status, r.BatchID, r.CreatedAt.Format(time.RFC3339)})
	}
	w.Flush()
}

func (h *Handler) deleteRedemption(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if err := h.s.DB.Delete(&store.RedemptionCode{}, id).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.emitAudit(c, "admin.redemption.delete", fmt.Sprintf("redemption:%d", id), nil)
	response.OK(c, gin.H{"ok": true})
}

// ---------- announcements ----------

func (h *Handler) listAnnouncements(c *gin.Context) {
	var rows []store.Announcement
	if err := h.s.DB.Order("id DESC").Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	response.OK(c, rows)
}

type announcementReq struct {
	Title   string `json:"title" binding:"required,max=255"`
	Content string `json:"content"`
	Level   string `json:"level"`
	Status  string `json:"status"`
}

func (h *Handler) createAnnouncement(c *gin.Context) {
	var req announcementReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	a := store.Announcement{
		Title:   req.Title,
		Content: req.Content,
		Level:   orDefault(req.Level, "info"),
		Status:  orDefault(req.Status, "draft"),
	}
	if err := h.s.DB.Create(&a).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.emitAudit(c, "admin.announcement.create", fmt.Sprintf("announcement:%d", a.ID), gin.H{
		"title":  a.Title,
		"level":  a.Level,
		"status": a.Status,
	})
	response.Created(c, a)
}

func (h *Handler) updateAnnouncement(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var a store.Announcement
	if err := h.s.DB.First(&a, id).Error; err != nil {
		response.Fail(c, errkit.ErrNotFound)
		return
	}
	var req announcementReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	if err := h.s.DB.Model(&a).Updates(map[string]any{
		"title":   req.Title,
		"content": req.Content,
		"level":   orDefault(req.Level, a.Level),
		"status":  orDefault(req.Status, a.Status),
	}).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.s.DB.First(&a, id)
	h.emitAudit(c, "admin.announcement.update", fmt.Sprintf("announcement:%d", id), gin.H{
		"title":  req.Title,
		"status": req.Status,
		"level":  req.Level,
	})
	response.OK(c, a)
}

func (h *Handler) deleteAnnouncement(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if err := h.s.DB.Delete(&store.Announcement{}, id).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	h.emitAudit(c, "admin.announcement.delete", fmt.Sprintf("announcement:%d", id), nil)
	response.OK(c, gin.H{"ok": true})
}

// ---------- settings ----------

func (h *Handler) getSettings(c *gin.Context) {
	var rows []store.Setting
	if err := h.s.DB.Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	out := map[string]any{}
	for _, r := range rows {
		if isSensitiveSettingKey(r.Key) {
			out[r.Key] = ""
			continue
		}
		var v any
		if err := json.Unmarshal([]byte(r.Value), &v); err == nil {
			out[r.Key] = v
		} else {
			out[r.Key] = r.Value
		}
	}
	response.OK(c, out)
}

func (h *Handler) updateSettings(c *gin.Context) {
	var payload map[string]any
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Fail(c, errkit.BadRequest("参数有误"))
		return
	}
	keys := make([]string, 0, len(payload))
	for k, v := range payload {
		raw, err := json.Marshal(v)
		if err != nil {
			response.Fail(c, errkit.BadRequest("非法的设置值"))
			return
		}
		s := store.Setting{Key: k, Value: string(raw)}
		if err := h.s.DB.Save(&s).Error; err != nil {
			response.Fail(c, errkit.ErrInternal)
			return
		}
		keys = append(keys, k)
	}
	h.emitAudit(c, "admin.settings.update", "", gin.H{"keys": keys})
	response.OK(c, gin.H{"ok": true})
}

func isSensitiveSettingKey(key string) bool {
	key = strings.ToLower(strings.TrimSpace(key))
	for _, marker := range []string{"password", "secret", "privatekey", "private_key", "access_token", "refresh_token"} {
		if strings.Contains(key, marker) {
			return true
		}
	}
	return false
}

// ---------- helpers ----------

func orDefault(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}

func defaultInt(v, def int) int {
	if v == 0 {
		return def
	}
	return v
}

func boolDefault(v *bool, def bool) bool {
	if v == nil {
		return def
	}
	return *v
}

func parseRatio(s, def string) (decimal.Decimal, error) {
	if strings.TrimSpace(s) == "" {
		s = def
	}
	return decimal.NewFromString(s)
}

func maskSecret(s string) string {
	if len(s) <= 8 {
		return strings.Repeat("*", len(s))
	}
	return s[:4] + "***" + s[len(s)-4:]
}
