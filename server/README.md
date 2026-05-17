# getoken-server

GeToken 的 Go 后端。详见仓库根 [README.md](../README.md) 与 [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)。

## 模块速览

| 包 | 职责 |
|---|---|
| `cmd/getoken` | 入口；启用 decimal-as-number JSON 序列化、运行迁移、注册默认 admin |
| `internal/server` | Gin 引擎装配、中间件链、路由树 |
| `internal/middleware` | RequestID / Recovery / Logger / CORS / JWT Auth |
| `internal/config` | godotenv 加载 + 校验 |
| `internal/response` | `{data}` / `{message,code}` 响应包装、`Page<T>` 泛型 |
| `internal/store` | GORM 模型、连接池、`migrations/*.sql` 编译期 embed |
| `internal/auth` | 登录/注册/找回密码/发码/登出；EnsureAdmin 首启建默认管理员 |
| `internal/user` | `/api/user/self`、改密码、邀请明细（含 invitee 邮箱与累计消费） |
| `internal/token` | `/api/token` CRUD；明文 key 仅创建时返回一次，DB 存 HMAC-SHA256，支持模型白名单和 Key 级限流 |
| `internal/log` | `/api/log` 列表 + CSV 导出；type 默认过滤 `request` |
| `internal/stats` | 用户与管理员总览；revenue 来源 audit_logs(`topup.redeem`, `topup.order.completed`) |
| `internal/topup` | 卡密兑换、在线充值订单、开发环境模拟支付 |
| `internal/admin` | 管理员域所有 CRUD + `seed-defaults`、settings 读写、redemption 批量 |
| `internal/audit` | `audit.Emit(tx, log, Event)`；admin / auth / topup / referral 全打点 |
| `internal/referral` | `referral.Apply(tx, log, invitee, spent, ...)` —— 消费时触发 |
| `internal/public` | 无鉴权 `/api/public/{models,status,announcements}` |
| `internal/relay` | `/v1/*` / `/v1beta/*` 转发层（OpenAI + Anthropic + Gemini），含 token 鉴权、路由、预扣、SSE 透传、usage 解析、结算 |
| `internal/billing` | 计费公式 + 内置模型默认价格表 |

## 完整路由表

由 `internal/server/server.go` 装配，下面按访问层级分组。

### Layer 1：完全公开

| 方法 | 路径 |
|---|---|
| GET | `/healthz` |
| POST | `/api/auth/login` |
| POST | `/api/auth/register` |
| POST | `/api/auth/send-code` |
| POST | `/api/auth/forgot` |
| GET | `/api/public/models` |
| GET | `/api/public/status` |
| GET | `/api/public/announcements` |
| POST | `/api/payment/alipay/notify` |
| GET / POST | `/api/oauth/upstream/callback` |

### Layer 2：JWT 已登录（普通用户）

| 方法 | 路径 |
|---|---|
| POST | `/api/auth/logout` |
| GET / PUT | `/api/user/self` |
| PUT | `/api/user/password` |
| GET | `/api/user/referrals` |
| GET / POST / PUT / DELETE | `/api/token[/:id]` |
| GET | `/api/log[/export]` |
| GET | `/api/stats?range=Nd` |
| POST | `/api/topup/redeem` |
| POST | `/api/topup/order` |
| GET | `/api/topup/orders` |
| POST | `/api/topup/orders/:id/cancel` |
| POST | `/api/topup/orders/:id/simulate-paid` | development only |

### Layer 3：JWT + role=admin

| 方法 | 路径 |
|---|---|
| GET | `/api/admin/stats?range=Nd` |
| GET / POST / PUT / DELETE | `/api/admin/users[/:id]` |
| GET / POST / PUT / DELETE | `/api/admin/upstreams[/:id]` |
| POST | `/api/admin/upstreams/bulk-status` |
| POST | `/api/admin/upstreams/:id/check` |
| POST | `/api/admin/upstreams/:id/sync-models` |
| GET / POST / PUT / DELETE | `/api/admin/upstream-accounts[/:id]` |
| POST | `/api/admin/upstream-accounts/:id/check` |
| POST | `/api/admin/upstream-accounts/:id/recover` |
| POST | `/api/admin/upstream-accounts/:id/oauth/start` |
| POST | `/api/admin/upstream-accounts/:id/refresh-oauth` |
| GET | `/api/admin/ops/snapshot` |
| GET | `/api/admin/ops/accounts` |
| GET | `/api/admin/ops/errors` |
| GET / POST / PUT / DELETE | `/api/admin/models[/:id]` |
| POST | `/api/admin/models/seed-defaults` |
| GET / POST / PUT / DELETE | `/api/admin/groups[/:id]` |
| GET | `/api/admin/logs[/export]` |
| GET / POST / DELETE | `/api/admin/redemption[/:id]` |
| GET | `/api/admin/redemption/export` |
| GET / POST / PUT / DELETE | `/api/admin/announcements[/:id]` |
| GET / PUT | `/api/admin/settings` |
| GET | `/api/admin/audit[?action=&actorId=&targetUserId=]` |

### Layer 4：sk-getoken-* API Key（LLM 转发）

| 方法 | 路径 | 协议 |
|---|---|---|
| GET | `/v1/models` | — |
| GET | `/v1/models/{model}` | — |
| GET | `/v1/usage?range=Nd` | — |
| GET | `/v1/account/balance` | — |
| POST | `/v1/chat/completions` | OpenAI |
| POST | `/v1/completions` | OpenAI |
| POST | `/v1/responses` | OpenAI |
| POST | `/responses` | OpenAI Responses alias |
| POST | `/backend-api/codex/responses` | Codex Responses alias |
| POST | `/v1/images/generations` | OpenAI Images |
| POST | `/v1/images/edits` | OpenAI Images |
| POST | `/v1/images/variations` | OpenAI Images |
| POST | `/v1/messages` | Anthropic |
| POST | `/v1/messages/count_tokens` | Anthropic |
| GET | `/v1beta/models` | Gemini |
| GET | `/v1beta/models/{model}` | Gemini |
| POST | `/v1beta/models/{model}:generateContent` | Gemini |
| POST | `/v1beta/models/{model}:streamGenerateContent` | Gemini |
| POST | `/antigravity/v1/messages` | Antigravity Claude alias |
| POST | `/antigravity/v1beta/models/{model}:generateContent` | Antigravity Gemini alias |

鉴权头：`Authorization: Bearer sk-getoken-...` 或 `x-api-key: sk-getoken-...`。

## 开发

```bash
cp .env.example .env             # 改 JWT_SECRET / DATABASE_URL / REDIS_ADDR
docker compose up -d postgres redis
go run ./cmd/getoken             # 监听 :38883
```

### 常用命令

```bash
make tidy    # go mod tidy
make run     # go run ./cmd/getoken
make build   # 输出 bin/getoken（CGO_ENABLED=0）
make test    # go test ./...
make fmt     # gofmt -s -w .
```

### 数据库迁移

迁移文件在 `internal/store/migrations/*.sql`，用 `goose` 风格的 `-- +goose Up / Down` 标注，**编译期 embed 进二进制**。启动时自动到最新版本，无需手动操作。

新增字段：

```bash
touch internal/store/migrations/0007_xxx.sql
# 写 -- +goose Up / Down 两段，编辑完重启 server 自动 up
```

回滚（罕用，会丢数据，先备份）：

```go
// 临时入口：调用 goose.DownTo / Reset，通过专门 binary 或脚本
```

## 计费链路

```
1. 用户请求  POST /v1/chat/completions  Body: {model, messages, max_tokens}
2. relay.TokenAuth   → 校验 sk-getoken-*  → 注入 token + user 到 ctx
3. relay.ResolveRoute → 找 model_mapping + upstream + group
                       → 改写 body.model 为 upstreamModelName
                       → OpenAI 流式强制 stream_options.include_usage
4. relay.PreCharge   → 先检查 Token 模型白名单、Token/User 并发、QPS、TPS、RPM、TPM，再估算 = bytes/4 + max_tokens，扣 user.used_quota，余额不够 → 402
5. relay.Forward     → http.Client + SSE tee；按账号 proxy_url 转发；替换 Authorization → upstream/account credential
6. usage 解析        → 拿到真实 input/output/cached/cacheCreation/reasoning_tokens
7. relay.Finalize    → billing.CostUSDDetailed 算真实价
                       → delta = real - pre 调整 used_quota
                       → 扣 token.remain_quota（如非 unlimited）
                       → 写 logs(type=request) 一行
                       → referral.Apply 给邀请人发返利
```

失败路径自动 `Release` 退预扣 + 写 error log。

## 内置模型表

`internal/billing/defaults.go` 仅保留 Claude / GPT / Gemini 核心模型快照：

- **OpenAI**：gpt-5 / gpt-5-mini / gpt-4o / gpt-4o-mini / gpt-4-turbo / gpt-4 / gpt-3.5-turbo
- **Anthropic**：claude-sonnet-4-6 / claude-opus-4-7 / claude-haiku-4-5 / claude-3-5-sonnet-latest / claude-3-5-haiku-latest
- **Google**：gemini-2.5-pro / gemini-2.5-flash / gemini-2.0-flash / gemini-1.5-pro / gemini-1.5-flash

通过 `POST /api/admin/models/seed-defaults` 一键灌入 model_mappings 表。

## 计费公式

```
cost(USD) = ( input × inputPrice
            + output × outputPrice
            + cachedInput × cachedPrice            (=0 时回落 inputPrice)
            + cacheCreation × cacheCreationPrice   (=0 时回落 inputPrice)
            ) / 1_000_000
          × group.ratio
```

所有 price 均为 `USD per 1M tokens`，对齐 OpenAI / Anthropic 官方定价表。

## 审计事件清单

`audit_logs.action`：

| Action | 触发 |
|---|---|
| `auth.login` / `auth.register` / `auth.logout` / `auth.password.reset` | 认证流 |
| `user.password.change` | 用户改密码 |
| `topup.redeem` | 卡密兑换 |
| `topup.order.completed` | 支付宝订单异步通知验签后完成 |
| `referral.reward` | 邀请返利发放（消费触发） |
| `admin.user.{create,update,delete}` | 管理员对用户的写操作 |
| `admin.upstream.{create,update,delete,check,sync_models,bulk_status}` / `admin.upstream_account.oauth_refresh` | 上游配置变更（apiKey / OAuth Token 已脱敏为 `***`） |
| `admin.model.{create,update,delete,seed}` | 模型映射 |
| `admin.group.{create,update,delete}` | 分组 |
| `admin.redemption.batch.create` / `admin.redemption.delete` | 卡密管理 |
| `admin.announcement.{create,update,delete}` | 公告 |
| `admin.settings.update` | 系统设置（只记 key 列表，不记 value） |
