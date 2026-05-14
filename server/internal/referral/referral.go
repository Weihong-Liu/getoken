// Package referral 集中处理「被邀请人消费 → 邀请人返利」的链路。
//
// 设计原则：
//   - 只在被邀请人**真实 API 调用消费**时触发（不在充值时触发）。
//   - 调用方在写 `logs` (type=request) 的同一事务里调 Apply，保证原子性。
//   - 比例从 settings.invite.rewardPercent 读取，0 即关闭。
package referral

import (
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/puppet/getoken/server/internal/audit"
	"github.com/puppet/getoken/server/internal/store"
)

// Apply 在消费事件成功落库后，按 invite.rewardPercent 给邀请人发奖励。
//
// 入参：
//   - tx        当前事务（与写 logs 同一个）
//   - log       zap logger
//   - invitee   消费的用户对象（必须包含 ID 与 InvitedBy）
//   - spent     本次消费金额（NUMERIC(18,6)）
//   - sourceTag 审计 target，建议传 logs.id 或 "request:<n>" 这种可追溯字符串
//   - ip        client ip
//
// 返回错误意味着事务应回滚；nil 表示不必发奖励（无邀请人 / 设置为 0 / 金额为 0）
// 或者奖励已成功派发并写入审计。
func Apply(tx *gorm.DB, log *zap.Logger, invitee *store.User, spent decimal.Decimal, sourceTag, ip string) error {
	if invitee == nil || invitee.InvitedBy == nil || !spent.GreaterThan(decimal.Zero) {
		return nil
	}
	percent := store.SettingDecimal(tx, "invite.rewardPercent", decimal.Zero)
	if !percent.GreaterThan(decimal.Zero) {
		return nil
	}
	reward := spent.Mul(percent).Div(decimal.NewFromInt(100))
	if !reward.GreaterThan(decimal.Zero) {
		return nil
	}
	if err := tx.Model(&store.User{}).Where("id = ?", *invitee.InvitedBy).
		UpdateColumn("quota", gorm.Expr("quota + ?", reward)).Error; err != nil {
		return err
	}
	if err := tx.Create(&store.Referral{
		InviterID:   *invitee.InvitedBy,
		InviteeID:   invitee.ID,
		RewardQuota: reward,
	}).Error; err != nil {
		return err
	}
	audit.Emit(tx, log, audit.Event{
		ActorID:      invitee.ID,
		TargetUserID: invitee.InvitedBy,
		Action:       "referral.reward",
		Target:       sourceTag,
		Amount:       reward,
		Detail: map[string]any{
			"percent":    percent,
			"fromAmount": spent,
			"source":     sourceTag,
		},
		IP: ip,
	})
	return nil
}
