// Package billing 计算单次 API 调用应扣除的额度（USD）。
//
// 完整公式：
//
//	cost = ( Input         × inputPrice
//	       + Output        × outputPrice
//	       + CachedInput   × cachedPrice         (cachedPrice=0 时按 inputPrice 计)
//	       + CacheCreation × cacheCreationPrice  (cacheCreationPrice=0 时按 inputPrice 计)
//	       ) / 1_000_000
//	     × group.ratio
//
//	所有 price 单位均为 USD / 1M tokens
//	group.ratio 是用户分组倍率，默认 1.0
package billing

import (
	"github.com/shopspring/decimal"

	"github.com/puppet/getoken/server/internal/store"
)

const million = 1_000_000

// Tokens 描述一次请求中各类 token 的计数。
//
// 约定：CachedInput / CacheCreation 与 Input 是【相互独立的桶】，
// 调用方在拿到上游 usage 字段后应当先把 cache 相关的 tokens 从 Input 里减出来再传入。
type Tokens struct {
	Input         int
	Output        int
	CachedInput   int // 命中缓存的输入 token（OpenAI cached_tokens / Anthropic cache_read_input_tokens）
	CacheCreation int // 写缓存的 token（Anthropic cache_creation_input_tokens）
}

// CostUSDDetailed 按完整公式计算扣费金额。
func CostUSDDetailed(model *store.ModelMapping, group *store.Group, t Tokens) decimal.Decimal {
	if model == nil {
		return decimal.Zero
	}
	cachedPrice := model.CachedPrice
	if cachedPrice.IsZero() {
		cachedPrice = model.InputPrice
	}
	cacheCreatePrice := model.CacheCreationPrice
	if cacheCreatePrice.IsZero() {
		cacheCreatePrice = model.InputPrice
	}
	in := decimal.NewFromInt(int64(t.Input)).Mul(model.InputPrice)
	out := decimal.NewFromInt(int64(t.Output)).Mul(model.OutputPrice)
	cached := decimal.NewFromInt(int64(t.CachedInput)).Mul(cachedPrice)
	create := decimal.NewFromInt(int64(t.CacheCreation)).Mul(cacheCreatePrice)
	cost := in.Add(out).Add(cached).Add(create).Div(decimal.NewFromInt(million))
	if group != nil && group.Ratio.GreaterThan(decimal.Zero) {
		cost = cost.Mul(group.Ratio)
	}
	return cost
}

// CostUSD 保留旧签名，等同于 CostUSDDetailed{Input, Output}，便于兼容老调用点。
func CostUSD(model *store.ModelMapping, group *store.Group, inTokens, outTokens int) decimal.Decimal {
	return CostUSDDetailed(model, group, Tokens{Input: inTokens, Output: outTokens})
}
