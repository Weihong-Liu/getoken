package store

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"github.com/puppet/getoken/server/internal/config"
)

type Store struct {
	DB    *gorm.DB
	Redis *redis.Client
}

func Open(ctx context.Context, cfg *config.Config, log *zap.Logger) (*Store, error) {
	gormCfg := &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Warn),
	}
	if cfg.Env == "production" {
		gormCfg.Logger = gormlogger.Default.LogMode(gormlogger.Error)
	}
	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), gormCfg)
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(40)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(time.Hour)

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := sqlDB.PingContext(pingCtx); err != nil {
		return nil, err
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	if err := rdb.Ping(pingCtx).Err(); err != nil {
		log.Warn("redis ping failed", zap.Error(err))
	}

	log.Info("store connected",
		zap.String("postgres", "ok"),
		zap.String("redis", cfg.RedisAddr),
	)
	return &Store{DB: db, Redis: rdb}, nil
}

func (s *Store) Close() {
	if s.Redis != nil {
		_ = s.Redis.Close()
	}
	if s.DB != nil {
		if sqlDB, err := s.DB.DB(); err == nil {
			_ = sqlDB.Close()
		}
	}
}
