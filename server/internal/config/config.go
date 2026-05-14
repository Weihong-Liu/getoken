package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	HTTPAddr string
	Env      string
	LogLevel string

	DatabaseURL string

	RedisAddr     string
	RedisPassword string
	RedisDB       int

	JWTSecret string
	JWTTTL    time.Duration

	AdminEmail    string
	AdminPassword string
	AdminUsername string

	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	SMTPFrom     string

	RegisterEnabled            bool
	RegisterInviteRequired     bool
	RegisterEmailCodeRequired  bool

	CORSOrigins []string
}

func Load() (*Config, error) {
	_ = godotenv.Load() // .env is optional

	c := &Config{
		HTTPAddr: env("HTTP_ADDR", ":3000"),
		Env:      env("ENV", "development"),
		LogLevel: env("LOG_LEVEL", "info"),

		DatabaseURL: env("DATABASE_URL", ""),

		RedisAddr:     env("REDIS_ADDR", "localhost:6379"),
		RedisPassword: env("REDIS_PASSWORD", ""),
		RedisDB:       envInt("REDIS_DB", 0),

		JWTSecret: env("JWT_SECRET", ""),
		JWTTTL:    time.Duration(envInt("JWT_TTL_HOURS", 72)) * time.Hour,

		AdminEmail:    env("ADMIN_EMAIL", ""),
		AdminPassword: env("ADMIN_PASSWORD", ""),
		AdminUsername: env("ADMIN_USERNAME", "Admin"),

		SMTPHost:     env("SMTP_HOST", ""),
		SMTPPort:     envInt("SMTP_PORT", 465),
		SMTPUsername: env("SMTP_USERNAME", ""),
		SMTPPassword: env("SMTP_PASSWORD", ""),
		SMTPFrom:     env("SMTP_FROM", ""),

		RegisterEnabled:           envBool("REGISTER_ENABLED", true),
		RegisterInviteRequired:    envBool("REGISTER_INVITE_REQUIRED", false),
		RegisterEmailCodeRequired: envBool("REGISTER_EMAIL_CODE_REQUIRED", true),

		CORSOrigins: splitCSV(env("CORS_ORIGINS", "http://localhost:5173")),
	}

	if c.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if c.JWTSecret == "" || len(c.JWTSecret) < 16 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 16 chars")
	}
	return c, nil
}

func (c *Config) SMTPEnabled() bool { return c.SMTPHost != "" && c.SMTPFrom != "" }

func env(k, def string) string {
	if v, ok := os.LookupEnv(k); ok && v != "" {
		return v
	}
	return def
}

func envInt(k string, def int) int {
	if v, ok := os.LookupEnv(k); ok && v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func envBool(k string, def bool) bool {
	if v, ok := os.LookupEnv(k); ok && v != "" {
		b, err := strconv.ParseBool(v)
		if err == nil {
			return b
		}
	}
	return def
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
