package relay

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/puppet/getoken/server/internal/billing"
	"github.com/puppet/getoken/server/internal/referral"
	"github.com/puppet/getoken/server/internal/store"
)

// SettleCtx 在请求生命周期内携带预扣金额与基础信息，便于 Forward 完成后结算。
type SettleCtx struct {
	User       *store.User
	Token      *store.Token
	Route      *RouteResult
	PreCharged decimal.Decimal
	// 标记预扣是否已经原状回滚 (出错路径要避免双重扣减)。
	released bool
}

// PreCharge：在事务里先把预估额度扣到 user.used_quota，避免并发请求超扣。
// 预估方式：raw body 字节数 / 4 当 prompt tokens + 用户 max_tokens 当 output tokens；
// 没有 max_tokens 给一个保守默认 1024，避免无限超扣。
func PreCharge(c *gin.Context, s *store.Store, log *zap.Logger, user *store.User, token *store.Token, route *RouteResult) (*SettleCtx, error) {
	est := estimateTokens(route)
	preCost := billing.CostUSDDetailed(route.Model, route.Group, est)
	if !preCost.GreaterThan(decimal.Zero) {
		// 没有定价 / 全免：仍记录 ctx，结算阶段照常运转。
		return &SettleCtx{User: user, Token: token, Route: route, PreCharged: decimal.Zero}, nil
	}

	err := s.DB.Transaction(func(tx *gorm.DB) error {
		// 加锁读一遍 user。
		var u store.User
		if err := tx.Where("id = ?", user.ID).First(&u).Error; err != nil {
			return err
		}
		remain := u.Quota.Sub(u.UsedQuota)
		if remain.LessThan(preCost) {
			return newRelayErr(http.StatusPaymentRequired, "insufficient_quota",
				"user_quota_insufficient", "remaining quota cannot cover the predicted cost")
		}
		// token 限额校验。
		if !token.UnlimitedQuota {
			var tk store.Token
			if err := tx.Where("id = ?", token.ID).First(&tk).Error; err != nil {
				return err
			}
			if tk.RemainQuota.LessThan(preCost) {
				return newRelayErr(http.StatusPaymentRequired, "insufficient_quota",
					"token_quota_insufficient", "token remaining quota cannot cover the predicted cost")
			}
		}
		// 占用 user.used_quota。
		if err := tx.Model(&store.User{}).Where("id = ?", user.ID).
			UpdateColumn("used_quota", gorm.Expr("used_quota + ?", preCost)).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &SettleCtx{User: user, Token: token, Route: route, PreCharged: preCost}, nil
}

// Release 把预扣无条件退回（用在请求未实际产生消费的场景：上游连不上、解析失败等）。
func (sc *SettleCtx) Release(s *store.Store, log *zap.Logger) {
	if sc == nil || sc.released || !sc.PreCharged.GreaterThan(decimal.Zero) {
		sc.released = true
		return
	}
	err := s.DB.Model(&store.User{}).Where("id = ?", sc.User.ID).
		UpdateColumn("used_quota", gorm.Expr("used_quota - ?", sc.PreCharged)).Error
	if err != nil && log != nil {
		log.Warn("relay release pre-charge failed", zap.Error(err), zap.Uint64("userId", sc.User.ID))
	}
	sc.released = true
}

// Finalize 在拿到真实 usage / 失败状态后，写日志 + 调整额度 + 触发返利。
//
// 入参:
//
//	usage:  真实 usage（成功时填）；失败/解析不到时传零值并把 success=false。
//	success: 上游响应是否 2xx 且 usage 可解析。
//	statusCode: 上游 HTTP 状态码（用于审计/日志）。
//	errMsg: 错误信息（若有）。
func (sc *SettleCtx) Finalize(c *gin.Context, s *store.Store, log *zap.Logger, usage billing.Tokens, reasoningTokens int, success bool, statusCode int, errMsg string) {
	if sc == nil {
		return
	}
	latency := int(time.Since(startedAtFromCtx(c)).Milliseconds())

	var realCost decimal.Decimal
	if success {
		realCost = billing.CostUSDDetailed(sc.Route.Model, sc.Route.Group, usage)
	}
	// 若预扣已经 Release 过，account 余额已经回归；delta 直接以 realCost 计算。
	pre := sc.PreCharged
	if sc.released {
		pre = decimal.Zero
	}
	delta := realCost.Sub(pre) // 正：补扣；负：退还

	logRow := store.Log{
		UserID:              sc.User.ID,
		TokenID:             &sc.Token.ID,
		TokenName:           sc.Token.Name,
		Type:                "request",
		ModelName:           sc.Route.ModelName,
		PromptTokens:        usage.Input, // 未命中缓存的纯输入
		CompletionTokens:    usage.Output,
		CachedTokens:        usage.CachedInput,
		CacheCreationTokens: usage.CacheCreation,
		ReasoningEffort:     sc.Route.ReasoningEffort,
		ReasoningTokens:     reasoningTokens,
		Quota:               realCost,
		Status:              "success",
		LatencyMs:           latency,
	}
	if !success {
		logRow.Status = "error"
		if errMsg == "" {
			errMsg = "upstream error"
		}
		logRow.Error = "[" + strconv.Itoa(statusCode) + "] " + errMsg
	}

	err := s.DB.Transaction(func(tx *gorm.DB) error {
		// 1) 调整 user.used_quota：预扣已经在 PreCharge 阶段做掉，这里只补 delta。
		if delta.Sign() != 0 {
			if err := tx.Model(&store.User{}).Where("id = ?", sc.User.ID).
				UpdateColumn("used_quota", gorm.Expr("used_quota + ?", delta)).Error; err != nil {
				return err
			}
		}
		// 2) token.remain_quota 扣减（非 unlimited 时）。
		if !sc.Token.UnlimitedQuota && realCost.GreaterThan(decimal.Zero) {
			if err := tx.Model(&store.Token{}).Where("id = ?", sc.Token.ID).
				UpdateColumn("remain_quota", gorm.Expr("remain_quota - ?", realCost)).Error; err != nil {
				return err
			}
		}
		// 3) 写一条 log。
		if err := tx.Create(&logRow).Error; err != nil {
			return err
		}
		// 4) 返利（仅成功 & 有真实消费时）。
		if success && realCost.GreaterThan(decimal.Zero) {
			sourceTag := "request:" + strconv.FormatUint(logRow.ID, 10)
			if err := referral.Apply(tx, log, sc.User, realCost, sourceTag, c.ClientIP()); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil && log != nil {
		log.Warn("relay finalize failed", zap.Error(err),
			zap.Uint64("userId", sc.User.ID), zap.Uint64("tokenId", sc.Token.ID),
			zap.String("model", sc.Route.ModelName))
		// 兜底：若结算事务挂了，至少把预扣退还以免误扣。
		if sc.PreCharged.GreaterThan(decimal.Zero) {
			sc.Release(s, log)
		}
	}
	updateAccountHealth(s, sc.Route.UpstreamAccount, latency, success, statusCode, errMsg)
}

func updateAccountHealth(s *store.Store, account *store.UpstreamAccount, latency int, success bool, statusCode int, errMsg string) {
	if account == nil || account.ID == 0 {
		return
	}
	status := "online"
	lastError := ""
	if !success {
		lastError = errMsg
		status = account.Status
		if status == "" {
			status = "online"
		}
		switch {
		case statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden:
			status = "degraded"
		case statusCode == http.StatusTooManyRequests:
			status = "degraded"
		case statusCode >= 500 || statusCode == http.StatusBadGateway:
			status = "degraded"
		}
	}
	_ = s.DB.Model(&store.UpstreamAccount{}).
		Where("id = ?", account.ID).
		Updates(map[string]any{
			"status":        status,
			"latency_ms":    latency,
			"last_check_at": time.Now(),
			"last_error":    truncate(lastError, 512),
		}).Error
}

// estimateTokens 给预扣阶段算一个保守估计。
func estimateTokens(route *RouteResult) billing.Tokens {
	const charsPerToken = 4
	in := len(route.RawBody) / charsPerToken
	out := route.MaxTokens
	if out <= 0 {
		out = 1024
	}
	return billing.Tokens{Input: in, Output: out}
}
