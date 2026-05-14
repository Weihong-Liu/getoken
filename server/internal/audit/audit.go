package audit

import (
	"encoding/json"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/puppet/getoken/server/internal/middleware"
	"github.com/puppet/getoken/server/internal/pkg/errkit"
	"github.com/puppet/getoken/server/internal/pkg/paginate"
	"github.com/puppet/getoken/server/internal/response"
	"github.com/puppet/getoken/server/internal/store"
)

// Event is the payload Emit accepts.
type Event struct {
	ActorID      uint64
	TargetUserID *uint64
	Action       string
	Target       string
	Amount       decimal.Decimal
	Detail       any
	IP           string
}

// Emit writes one audit row. Uses the given tx (may be the outer transaction).
// Errors are logged but never returned — auditing must not fail the business op.
func Emit(tx *gorm.DB, log *zap.Logger, ev Event) {
	detailJSON := "{}"
	if ev.Detail != nil {
		if b, err := json.Marshal(ev.Detail); err == nil {
			detailJSON = string(b)
		}
	}
	row := store.AuditLog{
		ActorID:      ev.ActorID,
		TargetUserID: ev.TargetUserID,
		Action:       ev.Action,
		Target:       ev.Target,
		Amount:       ev.Amount,
		Detail:       detailJSON,
		IP:           ev.IP,
	}
	if err := tx.Create(&row).Error; err != nil && log != nil {
		log.Warn("audit emit failed", zap.String("action", ev.Action), zap.Error(err))
	}
}

// FromContext fills ActorID + IP from the gin context.
func FromContext(c *gin.Context) Event {
	ev := Event{IP: c.ClientIP()}
	if u := middleware.CurrentUser(c); u != nil {
		ev.ActorID = u.ID
	}
	return ev
}

// Handler exposes admin-only listing.
type Handler struct {
	s   *store.Store
	log *zap.Logger
}

func NewHandler(s *store.Store, log *zap.Logger) *Handler { return &Handler{s: s, log: log} }

func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("", h.list)
}

type auditView struct {
	store.AuditLog
	ActorEmail  string `json:"actorEmail,omitempty"`
	TargetEmail string `json:"targetEmail,omitempty"`
}

func (h *Handler) list(c *gin.Context) {
	page := paginate.FromQuery(c)
	q := h.s.DB.Model(&store.AuditLog{})
	if v := c.Query("action"); v != "" {
		q = q.Where("action = ?", v)
	}
	if v := c.Query("actorId"); v != "" {
		q = q.Where("actor_id = ?", v)
	}
	if v := c.Query("targetUserId"); v != "" {
		q = q.Where("target_user_id = ?", v)
	}

	var total int64
	q.Count(&total)

	var rows []store.AuditLog
	if err := page.Apply(q).Order("id DESC").Find(&rows).Error; err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}

	// Best-effort enrich actor/target emails (skip if zero / nil).
	views := make([]auditView, len(rows))
	emails := map[uint64]string{}
	ids := map[uint64]struct{}{}
	for _, r := range rows {
		if r.ActorID != 0 {
			ids[r.ActorID] = struct{}{}
		}
		if r.TargetUserID != nil {
			ids[*r.TargetUserID] = struct{}{}
		}
	}
	if len(ids) > 0 {
		list := make([]uint64, 0, len(ids))
		for id := range ids {
			list = append(list, id)
		}
		var users []struct {
			ID    uint64
			Email string
		}
		h.s.DB.Table("users").Select("id, email").Where("id IN ?", list).Scan(&users)
		for _, u := range users {
			emails[u.ID] = u.Email
		}
	}
	for i, r := range rows {
		v := auditView{AuditLog: r, ActorEmail: emails[r.ActorID]}
		if r.TargetUserID != nil {
			v.TargetEmail = emails[*r.TargetUserID]
		}
		views[i] = v
	}

	response.OK(c, response.Page[auditView]{
		Items: views, Total: total, Page: page.Page, PageSize: page.PageSize,
	})
}
