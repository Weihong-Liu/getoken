package store

import (
	"context"
	"embed"

	"github.com/pressly/goose/v3"
	"go.uber.org/zap"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Migrate runs goose migrations against the configured database.
func Migrate(ctx context.Context, s *Store, log *zap.Logger) error {
	sqlDB, err := s.DB.DB()
	if err != nil {
		return err
	}
	goose.SetBaseFS(migrationsFS)
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	log.Info("running migrations")
	return goose.UpContext(ctx, sqlDB, "migrations")
}
