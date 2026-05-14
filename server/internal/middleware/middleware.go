package middleware

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/puppet/getoken/server/internal/config"
	"github.com/puppet/getoken/server/internal/pkg/errkit"
	"github.com/puppet/getoken/server/internal/response"
	"github.com/puppet/getoken/server/internal/store"
)

const (
	ctxKeyUser = "currentUser"
	ctxKeyJTI  = "currentJTI"
)

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader("X-Request-Id")
		if id == "" {
			id = uuid.NewString()
		}
		c.Set("requestId", id)
		c.Writer.Header().Set("X-Request-Id", id)
		c.Next()
	}
}

func Recovery(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				log.Error("panic", zap.Any("err", r), zap.String("path", c.Request.URL.Path))
				response.Fail(c, errkit.ErrInternal)
			}
		}()
		c.Next()
	}
}

func Logger(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		log.Info("http",
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("dur", time.Since(start)),
			zap.String("rid", c.GetString("requestId")),
		)
	}
}

func CORS(origins []string) gin.HandlerFunc {
	allowed := map[string]bool{}
	for _, o := range origins {
		allowed[o] = true
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && allowed[origin] {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Vary", "Origin")
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS")
			c.Writer.Header().Set("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Request-Id")
		}
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

type Claims struct {
	UserID uint64 `json:"uid"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

type AuthOpt struct {
	AdminOnly bool
}

// Auth returns middleware that enforces a logged-in user. Pass AuthOpt{AdminOnly: true}
// to also require the admin role.
func Auth(cfg *config.Config, s *store.Store, opt AuthOpt) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := c.GetHeader("Authorization")
		if !strings.HasPrefix(raw, "Bearer ") {
			response.Fail(c, errkit.ErrUnauthorized)
			return
		}
		tokenStr := strings.TrimPrefix(raw, "Bearer ")
		claims := &Claims{}
		_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
			if t.Method.Alg() != "HS256" {
				return nil, errors.New("unexpected signing method")
			}
			return []byte(cfg.JWTSecret), nil
		})
		if err != nil || claims.UserID == 0 || claims.ID == "" {
			response.Fail(c, errkit.ErrUnauthorized)
			return
		}

		// Black-list check
		blackKey := "jwt:blacklist:" + claims.ID
		exists, err := s.Redis.Exists(c, blackKey).Result()
		if err == nil && exists > 0 {
			response.Fail(c, errkit.ErrUnauthorized)
			return
		} else if err != nil && !errors.Is(err, redis.Nil) {
			// Redis down — fall through but log later.
		}

		// Hydrate user
		var u store.User
		if err := s.DB.First(&u, claims.UserID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				response.Fail(c, errkit.ErrUnauthorized)
				return
			}
			response.Fail(c, errkit.ErrInternal)
			return
		}
		if u.Status == "banned" {
			response.Fail(c, errkit.Unauthorized("账号已被封禁"))
			return
		}
		if opt.AdminOnly && u.Role != "admin" {
			response.Fail(c, errkit.ErrForbidden)
			return
		}

		c.Set(ctxKeyUser, &u)
		c.Set(ctxKeyJTI, claims.ID)
		c.Next()
	}
}

func CurrentUser(c *gin.Context) *store.User {
	if v, ok := c.Get(ctxKeyUser); ok {
		if u, ok := v.(*store.User); ok {
			return u
		}
	}
	return nil
}

func CurrentJTI(c *gin.Context) string {
	return c.GetString(ctxKeyJTI)
}

// IssueJWT signs an access token for a user.
func IssueJWT(cfg *config.Config, userID uint64, role string) (string, string, time.Time, error) {
	jti := uuid.NewString()
	exp := time.Now().Add(cfg.JWTTTL)
	claims := &Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString([]byte(cfg.JWTSecret))
	return signed, jti, exp, err
}

// RevokeJWT puts a jti into the redis black-list until its original expiration.
func RevokeJWT(ctx context.Context, rdb *redis.Client, jti string, ttl time.Duration) error {
	return rdb.Set(ctx, "jwt:blacklist:"+jti, "1", ttl).Err()
}
