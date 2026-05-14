package store

import (
	"time"

	"github.com/shopspring/decimal"
)

type Group struct {
	ID        uint64          `gorm:"primaryKey" json:"id"`
	Name      string          `gorm:"uniqueIndex;size:64" json:"name"`
	Ratio     decimal.Decimal `gorm:"type:numeric(8,4);not null;default:1" json:"ratio"`
	Note      string          `gorm:"size:255" json:"note"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

type User struct {
	ID           uint64          `gorm:"primaryKey" json:"id"`
	Email        string          `gorm:"uniqueIndex;size:128" json:"email"`
	PasswordHash string          `gorm:"size:128;not null" json:"-"`
	Username     string          `gorm:"size:64" json:"username"`
	Role         string          `gorm:"size:16;not null;default:user" json:"role"`     // user / admin
	Status       string          `gorm:"size:16;not null;default:active" json:"status"` // active / banned
	GroupID      uint64          `gorm:"index;not null;default:1" json:"groupId"`
	Quota        decimal.Decimal `gorm:"type:numeric(18,6);not null;default:0" json:"quota"`
	UsedQuota    decimal.Decimal `gorm:"type:numeric(18,6);not null;default:0" json:"usedQuota"`
	InviteCode   string          `gorm:"uniqueIndex;size:32" json:"inviteCode"`
	InvitedBy    *uint64         `gorm:"index" json:"invitedBy,omitempty"`
	CreatedAt    time.Time       `json:"createdAt"`
	UpdatedAt    time.Time       `json:"updatedAt"`
}

type Token struct {
	ID             uint64          `gorm:"primaryKey" json:"id"`
	UserID         uint64          `gorm:"index;not null" json:"userId"`
	Name           string          `gorm:"size:64;not null" json:"name"`
	KeyHash        string          `gorm:"uniqueIndex;size:128;not null" json:"-"`
	KeyPrefix      string          `gorm:"size:32;not null" json:"keyPrefix"`
	Status         int             `gorm:"not null;default:1" json:"status"` // 1 active / 0 disabled
	RemainQuota    decimal.Decimal `gorm:"type:numeric(18,6);not null;default:0" json:"remainQuota"`
	UnlimitedQuota bool            `gorm:"not null;default:false" json:"unlimitedQuota"`
	ExpiredAt      *time.Time      `json:"expiredAt,omitempty"`
	GroupID        uint64          `gorm:"index;not null;default:1" json:"groupId"`
	IPWhitelist    string          `gorm:"type:text" json:"ipWhitelist"`
	CreatedAt      time.Time       `json:"createdAt"`
	UpdatedAt      time.Time       `json:"updatedAt"`
}

type Log struct {
	ID               uint64          `gorm:"primaryKey" json:"id"`
	UserID           uint64          `gorm:"index;not null" json:"userId"`
	TokenID          *uint64         `gorm:"index" json:"tokenId,omitempty"`
	TokenName        string          `gorm:"size:64" json:"tokenName"`
	Type             string          `gorm:"size:16;index;not null;default:request" json:"type"` // request/topup/system
	ModelName        string          `gorm:"size:64;index" json:"modelName"`
	PromptTokens         int             `gorm:"not null;default:0" json:"promptTokens"`
	CompletionTokens     int             `gorm:"not null;default:0" json:"completionTokens"`
	CachedTokens         int             `gorm:"column:cached_tokens;not null;default:0" json:"cachedTokens"`
	CacheCreationTokens  int             `gorm:"column:cache_creation_tokens;not null;default:0" json:"cacheCreationTokens"`
	ReasoningEffort      string          `gorm:"column:reasoning_effort;size:16;not null;default:''" json:"reasoningEffort"`
	ReasoningTokens      int             `gorm:"column:reasoning_tokens;not null;default:0" json:"reasoningTokens"`
	Quota            decimal.Decimal `gorm:"type:numeric(18,6);not null;default:0" json:"quota"`
	Status           string          `gorm:"size:16;not null;default:success" json:"status"`
	LatencyMs        int             `gorm:"not null;default:0" json:"latencyMs"`
	Error            string          `gorm:"type:text" json:"error,omitempty"`
	CreatedAt        time.Time       `gorm:"index" json:"createdAt"`
}

// Upstream represents an external aggregator (new-api / sub2api / one-api) we forward to.
type Upstream struct {
	ID          uint64    `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:64;not null" json:"name"`
	Type        string    `gorm:"size:32;not null;default:openai" json:"type"` // openai-compatible / anthropic / gemini ...
	BaseURL     string    `gorm:"size:255;not null" json:"baseUrl"`
	APIKey      string    `gorm:"size:255;not null" json:"-"`
	Status      string    `gorm:"size:16;not null;default:online" json:"status"` // online/degraded/offline
	Priority    int       `gorm:"not null;default:10" json:"priority"`
	Weight      int       `gorm:"not null;default:10" json:"weight"`
	LatencyMs   int       `gorm:"not null;default:0" json:"latencyMs"`
	LastCheckAt *time.Time `json:"lastCheckAt,omitempty"`
	Note        string    `gorm:"type:text" json:"note,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// ModelMapping declares a model exposed on this platform and which upstream serves it.
type ModelMapping struct {
	ID                 uint64          `gorm:"primaryKey" json:"id"`
	ModelID            string          `gorm:"uniqueIndex;size:96;not null" json:"modelId"`
	Vendor             string          `gorm:"size:32" json:"vendor"`
	UpstreamID         uint64          `gorm:"index;not null" json:"upstreamId"`
	UpstreamModelName  string          `gorm:"size:96;not null" json:"upstreamModelName"`
	InputPrice         decimal.Decimal `gorm:"column:input_price;type:numeric(12,6);not null;default:1" json:"inputPrice"`
	OutputPrice        decimal.Decimal `gorm:"column:output_price;type:numeric(12,6);not null;default:1" json:"outputPrice"`
	CachedPrice        decimal.Decimal `gorm:"column:cached_price;type:numeric(12,6);not null;default:0" json:"cachedPrice"`
	CacheCreationPrice decimal.Decimal `gorm:"column:cache_creation_price;type:numeric(12,6);not null;default:0" json:"cacheCreationPrice"`
	Context            int             `gorm:"not null;default:0" json:"context"`
	Status             string          `gorm:"size:16;not null;default:online" json:"status"`
	AllowedGroups      string          `gorm:"type:text" json:"allowedGroups"` // CSV of group names
	CreatedAt          time.Time       `json:"createdAt"`
	UpdatedAt          time.Time       `json:"updatedAt"`
}

type RedemptionCode struct {
	ID        uint64          `gorm:"primaryKey" json:"id"`
	Code      string          `gorm:"uniqueIndex;size:64;not null" json:"code"`
	Amount    decimal.Decimal `gorm:"type:numeric(18,6);not null" json:"amount"`
	Status    string          `gorm:"size:16;not null;default:unused" json:"status"` // unused/used
	BatchID   string          `gorm:"size:32;index" json:"batchId"`
	UsedBy    *uint64         `gorm:"index" json:"usedBy,omitempty"`
	UsedAt    *time.Time      `json:"usedAt,omitempty"`
	CreatedAt time.Time       `json:"createdAt"`
}

type Announcement struct {
	ID        uint64    `gorm:"primaryKey" json:"id"`
	Title     string    `gorm:"size:255;not null" json:"title"`
	Content   string    `gorm:"type:text" json:"content"`
	Level     string    `gorm:"size:16;not null;default:info" json:"level"`    // info/warning/danger
	Status    string    `gorm:"size:16;not null;default:draft" json:"status"`  // draft/published
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Setting struct {
	Key       string    `gorm:"primaryKey;size:64" json:"key"`
	Value     string    `gorm:"type:jsonb" json:"value"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type AuditLog struct {
	ID           uint64          `gorm:"primaryKey" json:"id"`
	ActorID      uint64          `gorm:"index;not null;default:0" json:"actorId"`
	TargetUserID *uint64         `gorm:"index" json:"targetUserId,omitempty"`
	Action       string          `gorm:"size:64;index;not null" json:"action"`
	Target       string          `gorm:"size:128;not null;default:''" json:"target"`
	Amount       decimal.Decimal `gorm:"type:numeric(18,6);not null;default:0" json:"amount"`
	Detail       string          `gorm:"type:jsonb;not null;default:'{}'" json:"detail"`
	IP           string          `gorm:"size:64;not null;default:''" json:"ip"`
	CreatedAt    time.Time       `gorm:"index" json:"createdAt"`
}

type Referral struct {
	ID          uint64          `gorm:"primaryKey" json:"id"`
	InviterID   uint64          `gorm:"index;not null" json:"inviterId"`
	InviteeID   uint64          `gorm:"index;not null" json:"inviteeId"`
	RewardQuota decimal.Decimal `gorm:"type:numeric(18,6);not null;default:0" json:"rewardQuota"`
	CreatedAt   time.Time       `json:"createdAt"`
}
