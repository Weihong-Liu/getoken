package server

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/puppet/getoken/server/internal/admin"
	"github.com/puppet/getoken/server/internal/audit"
	"github.com/puppet/getoken/server/internal/auth"
	"github.com/puppet/getoken/server/internal/config"
	logmod "github.com/puppet/getoken/server/internal/log"
	mailpkg "github.com/puppet/getoken/server/internal/mail"
	"github.com/puppet/getoken/server/internal/middleware"
	"github.com/puppet/getoken/server/internal/public"
	"github.com/puppet/getoken/server/internal/relay"
	"github.com/puppet/getoken/server/internal/response"
	"github.com/puppet/getoken/server/internal/stats"
	"github.com/puppet/getoken/server/internal/store"
	"github.com/puppet/getoken/server/internal/token"
	"github.com/puppet/getoken/server/internal/topup"
	"github.com/puppet/getoken/server/internal/user"
)

func New(cfg *config.Config, s *store.Store, log *zap.Logger) *gin.Engine {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(middleware.RequestID(), middleware.Recovery(log), middleware.Logger(log), middleware.CORS(cfg.CORSOrigins))

	r.GET("/healthz", func(c *gin.Context) { response.OK(c, gin.H{"ok": true}) })

	api := r.Group("/api")
	adminHandler := admin.NewHandler(s, log)

	// Outbound mailer is selected at boot from MAIL_PROVIDER env (resend / smtp / "").
	// One Sender per process — implementations are safe for concurrent use.
	mailer := mailpkg.New(cfg, log)

	// Public
	auth.NewHandler(cfg, s, log, mailer).Register(api.Group("/auth"))
	publicGroup := api.Group("/public")
	public.NewHandler(cfg, s, log).Register(publicGroup)
	topupHandler := topup.NewHandler(cfg, s, log)
	topupHandler.RegisterPublic(api.Group("/payment"))
	adminHandler.RegisterPublic(api.Group("/oauth"))

	// Authenticated user routes
	authed := api.Group("")
	authed.Use(middleware.Auth(cfg, s, middleware.AuthOpt{}))
	user.NewHandler(s, log).Register(authed.Group("/user"))
	token.NewHandler(cfg, s, log).Register(authed.Group("/token"))
	logmod.NewHandler(s, log).RegisterUser(authed.Group("/log"))
	stats.NewHandler(s, log).Register(authed.Group("/stats"))
	topupHandler.Register(authed.Group("/topup"))

	// Admin routes
	adminGroup := api.Group("/admin")
	adminGroup.Use(middleware.Auth(cfg, s, middleware.AuthOpt{AdminOnly: true}))
	adminHandler.Register(adminGroup)
	logmod.NewHandler(s, log).RegisterAdmin(adminGroup.Group("/logs"))
	stats.NewHandler(s, log).RegisterAdmin(adminGroup.Group("/stats"))
	audit.NewHandler(s, log).Register(adminGroup.Group("/audit"))

	// /v1 LLM relay (OpenAI + Anthropic compatible).
	relayHandler := relay.NewHandler(cfg, s, log)
	relayHandler.Register(r.Group("/v1"))
	relayHandler.RegisterGeminiBeta(r.Group("/v1beta"))
	relayHandler.RegisterAliases(r.Group(""))
	relayHandler.RegisterAntigravity(r.Group("/antigravity"))

	return r
}

// ServeHTTP runs the gin engine wrapped in an http.Server we can shut down gracefully.
func ServeHTTP(ctx context.Context, addr string, h http.Handler, log *zap.Logger) error {
	srv := &http.Server{Addr: addr, Handler: h}
	go func() {
		<-ctx.Done()
		log.Info("http server shutting down")
		_ = srv.Shutdown(context.Background())
	}()
	log.Info("http server listening", zap.String("addr", addr))
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}
