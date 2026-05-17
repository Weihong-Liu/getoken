package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"github.com/puppet/getoken/server/internal/auth"
	"github.com/puppet/getoken/server/internal/config"
	"github.com/puppet/getoken/server/internal/server"
	"github.com/puppet/getoken/server/internal/store"
)

func main() {
	// Internal health probe — invoked by container HEALTHCHECK CMD so we
	// don't have to ship wget/curl in the distroless image.
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := healthcheckSelf(); err != nil {
			fmt.Fprintln(os.Stderr, "healthcheck:", err)
			os.Exit(1)
		}
		return
	}
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "fatal:", err)
		os.Exit(1)
	}
}

func healthcheckSelf() error {
	addr := os.Getenv("HTTP_ADDR")
	if addr == "" {
		addr = ":3000"
	}
	if strings.HasPrefix(addr, ":") {
		addr = "127.0.0.1" + addr
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+addr+"/healthz", nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return nil
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
