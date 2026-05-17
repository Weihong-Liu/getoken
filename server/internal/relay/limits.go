package relay

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/puppet/getoken/server/internal/store"
)

func reserveUserLimits(ctx context.Context, s *store.Store, user *store.User, route *RouteResult) (string, error) {
	if s == nil || s.Redis == nil || user == nil || user.ID == 0 {
		return "", nil
	}
	est := estimateTokens(route)
	totalTokens := est.Input + est.Output + est.CachedInput + est.CacheCreation

	if user.QPSLimit > 0 {
		key := userQPSKey(user.ID)
		n, err := s.Redis.Incr(ctx, key).Result()
		if err == nil {
			_ = s.Redis.Expire(ctx, key, 3*time.Second).Err()
			if n > int64(user.QPSLimit) {
				return "", newRelayErr(http.StatusTooManyRequests, "rate_limit_error", "user_qps_exceeded", "user QPS limit exceeded")
			}
		}
	}

	if user.TPSLimit > 0 && totalTokens > 0 {
		key := userTPSKey(user.ID)
		n, err := s.Redis.IncrBy(ctx, key, int64(totalTokens)).Result()
		if err == nil {
			_ = s.Redis.Expire(ctx, key, 3*time.Second).Err()
			if n > int64(user.TPSLimit) {
				return "", newRelayErr(http.StatusTooManyRequests, "rate_limit_error", "user_tps_exceeded", "user TPS limit exceeded")
			}
		}
	}

	if user.RPMLimit > 0 {
		key := userRPMKey(user.ID)
		n, err := s.Redis.Incr(ctx, key).Result()
		if err == nil {
			_ = s.Redis.Expire(ctx, key, 2*time.Minute).Err()
			if n > int64(user.RPMLimit) {
				return "", newRelayErr(http.StatusTooManyRequests, "rate_limit_error", "user_rpm_exceeded", "user request rate limit exceeded")
			}
		}
	}

	if user.TPMLimit > 0 && totalTokens > 0 {
		key := userTPMKey(user.ID)
		n, err := s.Redis.IncrBy(ctx, key, int64(totalTokens)).Result()
		if err == nil {
			_ = s.Redis.Expire(ctx, key, 2*time.Minute).Err()
			if n > int64(user.TPMLimit) {
				return "", newRelayErr(http.StatusTooManyRequests, "rate_limit_error", "user_tpm_exceeded", "user token rate limit exceeded")
			}
		}
	}

	if user.ConcurrencyLimit <= 0 {
		return "", nil
	}
	key := userConcurrencyKey(user.ID)
	n, err := s.Redis.Incr(ctx, key).Result()
	if err != nil {
		return "", nil
	}
	_ = s.Redis.Expire(ctx, key, 6*time.Hour).Err()
	if n > int64(user.ConcurrencyLimit) {
		_ = s.Redis.Decr(ctx, key).Err()
		return "", newRelayErr(http.StatusTooManyRequests, "rate_limit_error", "user_concurrency_exceeded", "user concurrency limit exceeded")
	}
	return key, nil
}

func reserveTokenLimits(ctx context.Context, s *store.Store, token *store.Token, route *RouteResult) (string, error) {
	if s == nil || s.Redis == nil || token == nil || token.ID == 0 {
		return "", nil
	}
	est := estimateTokens(route)
	totalTokens := est.Input + est.Output + est.CachedInput + est.CacheCreation

	if token.QPSLimit > 0 {
		key := tokenQPSKey(token.ID)
		n, err := s.Redis.Incr(ctx, key).Result()
		if err == nil {
			_ = s.Redis.Expire(ctx, key, 3*time.Second).Err()
			if n > int64(token.QPSLimit) {
				return "", newRelayErr(http.StatusTooManyRequests, "rate_limit_error", "token_qps_exceeded", "token QPS limit exceeded")
			}
		}
	}

	if token.TPSLimit > 0 && totalTokens > 0 {
		key := tokenTPSKey(token.ID)
		n, err := s.Redis.IncrBy(ctx, key, int64(totalTokens)).Result()
		if err == nil {
			_ = s.Redis.Expire(ctx, key, 3*time.Second).Err()
			if n > int64(token.TPSLimit) {
				return "", newRelayErr(http.StatusTooManyRequests, "rate_limit_error", "token_tps_exceeded", "token TPS limit exceeded")
			}
		}
	}

	if token.RPMLimit > 0 {
		key := tokenRPMKey(token.ID)
		n, err := s.Redis.Incr(ctx, key).Result()
		if err == nil {
			_ = s.Redis.Expire(ctx, key, 2*time.Minute).Err()
			if n > int64(token.RPMLimit) {
				return "", newRelayErr(http.StatusTooManyRequests, "rate_limit_error", "token_rpm_exceeded", "token request rate limit exceeded")
			}
		}
	}

	if token.TPMLimit > 0 && totalTokens > 0 {
		key := tokenTPMKey(token.ID)
		n, err := s.Redis.IncrBy(ctx, key, int64(totalTokens)).Result()
		if err == nil {
			_ = s.Redis.Expire(ctx, key, 2*time.Minute).Err()
			if n > int64(token.TPMLimit) {
				return "", newRelayErr(http.StatusTooManyRequests, "rate_limit_error", "token_tpm_exceeded", "token token rate limit exceeded")
			}
		}
	}

	if token.ConcurrencyLimit <= 0 {
		return "", nil
	}
	key := tokenConcurrencyKey(token.ID)
	n, err := s.Redis.Incr(ctx, key).Result()
	if err != nil {
		return "", nil
	}
	_ = s.Redis.Expire(ctx, key, 6*time.Hour).Err()
	if n > int64(token.ConcurrencyLimit) {
		_ = s.Redis.Decr(ctx, key).Err()
		return "", newRelayErr(http.StatusTooManyRequests, "rate_limit_error", "token_concurrency_exceeded", "token concurrency limit exceeded")
	}
	return key, nil
}

func releaseUserLease(s *store.Store, key string) {
	if s == nil || s.Redis == nil || key == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = s.Redis.Decr(ctx, key).Err()
}

func releaseTokenLease(s *store.Store, key string) {
	releaseUserLease(s, key)
}

func currentUserConcurrency(ctx context.Context, s *store.Store, userID uint64) int {
	if s == nil || s.Redis == nil || userID == 0 {
		return 0
	}
	n, err := s.Redis.Get(ctx, userConcurrencyKey(userID)).Int()
	if err == redis.Nil || err != nil || n < 0 {
		return 0
	}
	return n
}

func currentAccountConcurrency(ctx context.Context, s *store.Store, accountID uint64) int {
	if s == nil || s.Redis == nil || accountID == 0 {
		return 0
	}
	n, err := s.Redis.Get(ctx, accountConcurrencyKey(accountID)).Int()
	if err == redis.Nil || err != nil || n < 0 {
		return 0
	}
	return n
}

func userRPMKey(id uint64) string {
	return fmt.Sprintf("relay:user:%d:rpm:%s", id, time.Now().Format("200601021504"))
}

func tokenRPMKey(id uint64) string {
	return fmt.Sprintf("relay:token:%d:rpm:%s", id, time.Now().Format("200601021504"))
}

func userQPSKey(id uint64) string {
	return fmt.Sprintf("relay:user:%d:qps:%s", id, time.Now().Format("20060102150405"))
}

func tokenQPSKey(id uint64) string {
	return fmt.Sprintf("relay:token:%d:qps:%s", id, time.Now().Format("20060102150405"))
}

func userTPMKey(id uint64) string {
	return fmt.Sprintf("relay:user:%d:tpm:%s", id, time.Now().Format("200601021504"))
}

func tokenTPMKey(id uint64) string {
	return fmt.Sprintf("relay:token:%d:tpm:%s", id, time.Now().Format("200601021504"))
}

func userTPSKey(id uint64) string {
	return fmt.Sprintf("relay:user:%d:tps:%s", id, time.Now().Format("20060102150405"))
}

func tokenTPSKey(id uint64) string {
	return fmt.Sprintf("relay:token:%d:tps:%s", id, time.Now().Format("20060102150405"))
}

func userConcurrencyKey(id uint64) string {
	return fmt.Sprintf("relay:user:%d:concurrency", id)
}

func tokenConcurrencyKey(id uint64) string {
	return fmt.Sprintf("relay:token:%d:concurrency", id)
}
