package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"github.com/puppet/getoken/server/internal/auth"
	"github.com/puppet/getoken/server/internal/config"
	"github.com/puppet/getoken/server/internal/server"
	"github.com/puppet/getoken/server/internal/store"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "fatal:", err)
		os.Exit(1)
	}
}

func run() error {
	// Serialize decimals as JSON numbers so the frontend can keep using `number` types.
	decimal.MarshalJSONWithoutQuotes = true

	cfg, err := config.Load()
	if err != nil {
		return err
	}
	log, err := newLogger(cfg.Env, cfg.LogLevel)
	if err != nil {
		return err
	}
	defer log.Sync()

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	s, err := store.Open(ctx, cfg, log)
	if err != nil {
		return fmt.Errorf("open store: %w", err)
	}
	defer s.Close()

	if err := store.Migrate(ctx, s, log); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	if err := auth.EnsureAdmin(ctx, cfg, s, log); err != nil {
		return fmt.Errorf("ensure admin: %w", err)
	}

	engine := server.New(cfg, s, log)
	return server.ServeHTTP(ctx, cfg.HTTPAddr, engine, log)
}

func newLogger(env, level string) (*zap.Logger, error) {
	var lvl zapcore.Level
	if err := lvl.UnmarshalText([]byte(level)); err != nil {
		lvl = zapcore.InfoLevel
	}
	var cfg zap.Config
	if env == "production" {
		cfg = zap.NewProductionConfig()
	} else {
		cfg = zap.NewDevelopmentConfig()
	}
	cfg.Level = zap.NewAtomicLevelAt(lvl)
	return cfg.Build()
}
