# GeToken

面向终端用户的 **AI API 聚合中转平台**——做 sub2api / new-api 这类底层网关之上的"用户体验前台"。

- 用户拿 `sk-getoken-*` 一把钥匙调所有模型，按 token 实际消费扣费（USD）
- 管理员在后台配置**上游网关 → 模型映射 → 分组倍率 → 卡密发放**
- 自带 OpenAI / Anthropic 兼容转发，SSE 流式透传，缓存命中按折扣价计费
- 完整审计日志，邀请返利系统，金额单位 USD

```
用户 ──sk-getoken-*──► getoken (鉴权/计费/限额) ──► new-api / sub2api / one-api ──► OpenAI / Anthropic / ...
```

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Go 1.25 · Gin · GORM v2 · PostgreSQL 16 · Redis 7 |
| 计费 | shopspring/decimal · USD per 1M tokens |
| 认证 | JWT (HS256) + Redis 黑名单 · bcrypt · sk-getoken HMAC-SHA256 hash |
| 迁移 | pressly/goose 内嵌 SQL |
| 前端 | Vite 8 · React 19 · TypeScript · Tailwind v4 · SWR · Radix UI · Recharts |

## 仓库结构

```
getoken/
├── server/                 # Go 后端
│   ├── cmd/getoken/        # 入口
│   ├── internal/
│   │   ├── admin/          # /api/admin/* CRUD
│   │   ├── audit/          # 审计日志（写 + 查）
│   │   ├── auth/           # 登录/注册/找回密码/JWT
│   │   ├── billing/        # 按 token 计费公式 + 内置模型价格表
│   │   ├── config/         # env 加载
│   │   ├── log/            # 调用日志 + CSV
│   │   ├── middleware/     # Auth / CORS / RequestID
│   │   ├── pkg/            # errkit / paginate / idgen 工具
│   │   ├── public/         # /api/public/*（无鉴权）
│   │   ├── referral/       # 邀请返利（消费时触发）
│   │   ├── relay/          # /v1/* 转发层（OpenAI + Anthropic）
│   │   ├── response/       # 统一响应包装
│   │   ├── server/         # 路由装配
│   │   ├── stats/          # 用户与管理员总览数据
│   │   ├── store/          # GORM 模型、连接、迁移
│   │   │   └── migrations/ # *.sql 编译期 embed
│   │   ├── token/          # /api/token CRUD
│   │   ├── topup/          # 卡密兑换
│   │   └── user/           # 当前用户、改密码、邀请明细
│   ├── go.mod
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
├── web/                    # React 前端
│   ├── src/
│   │   ├── components/     # ui / marketing / dashboard
│   │   ├── hooks/
│   │   ├── lib/            # api.ts (类型 + apiFetch) · utils
│   │   ├── pages/
│   │   │   ├── admin/      # 管理后台 9 个页面
│   │   │   ├── auth/       # 登录/注册/找回
│   │   │   ├── dashboard/  # 用户控制台 6 个页面
│   │   │   └── marketing/  # 落地页 4 个
│   │   └── routes/router.tsx
│   ├── vite.config.ts
│   └── package.json
├── scripts/dev.sh          # tmux 分屏起后端 + 前端
├── docs/
│   └── DEPLOYMENT.md       # 生产部署指南
└── README.md               # 本文件
```

## 快速开始（本地开发）

### 1. 依赖

- Docker（起 Postgres + Redis）
- Go 1.25+
- Node 20+ 与 pnpm（或 npm）
- tmux（可选；脚本 `./scripts/dev.sh` 用它分屏）

### 2. 起依赖与配置

```bash
# 起 Postgres + Redis
cd server && docker compose up -d postgres redis

# 后端配置（按需修改 JWT_SECRET / ADMIN_EMAIL / ADMIN_PASSWORD）
cp .env.example .env
```

### 3. 一键开发模式

```bash
cd ..             # 回到项目根
./scripts/dev.sh  # tmux 左 backend(:38883) 右 frontend(:38838)
```

或者手工启动：
```bash
# 终端 A
cd server && go run ./cmd/getoken
# 终端 B
cd web && pnpm install && pnpm dev
```

打开 `http://localhost:38838`，默认管理员账号来自 `.env` 的 `ADMIN_EMAIL` / `ADMIN_PASSWORD`（默认 `admin@getoken.dev` / `Getoken123!`）。

### 4. 首次配置流程

1. 登录管理员账号
2. 「上游网关」→ 新增 upstream（写 sub2api / new-api / OpenAI 的 baseUrl + apiKey；**baseUrl 不带 `/v1`**）
3. 「模型管理」→ 点「导入内置模型」，选刚建的 upstream，一键灌入 31 个主流模型
4. 「系统设置 → 邀请返利」→ 填消费返利百分比（如 `5` 表示 5%）保存
5. 「卡密管理」→ 批量生成几张卡密
6. 普通用户兑换卡密 → 在 `/dashboard/tokens` 建 `sk-getoken-*` 密钥 → 用它发请求

## 功能接口清单

> 全部前缀 `/api`，响应统一信封 `{"data": ...}` / `{"message": "...", "code": "..."}`。

### 公开接口（无需鉴权）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/healthz` | 健康检查 |
| POST | `/api/auth/login` | 邮箱密码登录，返回 `{token, user}` |
| POST | `/api/auth/register` | 注册（邮箱码 + 可选邀请码），返回 `{token, user}` |
| POST | `/api/auth/send-code` | 发邮箱验证码（dev 模式回显 devCode） |
| POST | `/api/auth/forgot` | 找回密码（邮箱码验证 → 重置） |
| GET | `/api/public/models` | 公开模型清单（用于定价页等） |
| GET | `/api/public/status` | 上游网关健康度（脱敏） |
| GET | `/api/public/announcements` | 已发布公告 |

### 已登录用户

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/logout` | JWT 写入 Redis 黑名单 |
| GET·PUT | `/api/user/self` | 当前用户 / 改昵称 |
| PUT | `/api/user/password` | 改密码 |
| GET | `/api/user/referrals` | 邀请码 + 累计返利 + 邀请明细 |
| GET·POST·PUT·DELETE | `/api/token` | API Key CRUD（明文 key 仅创建时一次返回） |
| GET | `/api/log[?type=&model=&status=&page=&pageSize=]` | 调用日志（默认仅 type=request） |
| GET | `/api/log/export` | 调用日志 CSV 流式下载 |
| GET | `/api/stats?range=14d` | 余额 / 今日消费 / 近 N 天曲线 / Top 模型 |
| POST | `/api/topup/redeem` | 卡密兑换 |

### 管理员（role=admin）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/stats?range=14d` | 平台总览（用户数、token 数、收入、请求量） |
| GET·POST·PUT·DELETE | `/api/admin/users[/:id]` | 用户管理（角色、状态、额度、密码） |
| GET·POST·PUT·DELETE | `/api/admin/upstreams[/:id]` | 上游网关（new-api / sub2api / 官方端点） |
| GET·POST·PUT·DELETE | `/api/admin/models[/:id]` | 模型映射 + 价格 |
| POST | `/api/admin/models/seed-defaults` | 一键导入 31 个内置模型价格 |
| GET·POST·PUT·DELETE | `/api/admin/groups[/:id]` | 用户分组与倍率 |
| GET | `/api/admin/logs[/export]` | 全站调用日志 + CSV |
| GET·POST·DELETE | `/api/admin/redemption[/:id]` | 卡密 CRUD（批量生成） |
| GET | `/api/admin/redemption/export?batch=&status=` | 卡密 CSV |
| GET·POST·PUT·DELETE | `/api/admin/announcements[/:id]` | 公告 |
| GET·PUT | `/api/admin/settings` | 系统设置（KV + JSONB） |
| GET | `/api/admin/audit[?action=&actorId=&targetUserId=]` | 审计日志（登录、写操作、兑换、返利） |

### LLM 转发（OpenAI / Anthropic 兼容）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/v1/chat/completions` | OpenAI Chat（含 SSE 流式） |
| POST | `/v1/completions` | OpenAI Completions |
| POST | `/v1/embeddings` | OpenAI Embeddings |
| POST | `/v1/messages` | Anthropic Messages（含 SSE 流式） |
| GET | `/v1/models` | OpenAI 兼容的模型列表（按用户分组过滤） |

**鉴权头**：`Authorization: Bearer sk-getoken-...` 或 `x-api-key: sk-getoken-...`（两种都支持）

**计费公式**：

```
cost(USD) = ( input × inputPrice
            + output × outputPrice
            + cachedInput × cachedPrice            (cachedPrice=0 时回落 inputPrice)
            + cacheCreation × cacheCreationPrice   (同上)
            ) / 1_000_000
          × group.ratio
```

价格单位均为 **USD per 1M tokens**，从上游响应的 `usage` 字段实时解析。

## 数据模型

- `users`：邮箱、密码哈希、角色、状态、分组、quota / used_quota、邀请码
- `tokens`：每张 API key，key_hash 存 HMAC-SHA256，前缀展示
- `logs`：每次 API 调用一条，含 prompt / cached / cacheCreation / completion / reasoning tokens + quota
- `audit_logs`：登录、管理员变更、兑换、返利等关键事件
- `upstreams`：上游网关 (name, baseUrl, apiKey, priority, weight)
- `model_mappings`：对外 modelId → upstreamId + upstreamModelName + 价格四件套
- `groups`：分组名称 + 倍率
- `redemption_codes`：卡密（批次、面额、状态）
- `referrals`：邀请人 → 被邀请人 → 返利金额
- `settings`：全局 KV（JSONB value）
- `announcements`：公告（draft / published）

详细 schema 见 `server/internal/store/migrations/*.sql`。

## 配置项（server/.env）

| Key | 默认 | 说明 |
|---|---|---|
| `HTTP_ADDR` | `:38883` | 监听地址 |
| `ENV` | `development` | `development` 时发码会回显，便于本地测 |
| `DATABASE_URL` | — | postgres 连接串（必填） |
| `REDIS_ADDR` | `localhost:6379` | Redis 地址 |
| `JWT_SECRET` | — | ≥16 字符随机串（必填） |
| `JWT_TTL_HOURS` | 72 | Web 登录 JWT 有效期 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | users 表为空时自动创建 |
| `REGISTER_ENABLED` | true | 是否开放注册 |
| `REGISTER_INVITE_REQUIRED` | false | 注册是否强制邀请码 |
| `REGISTER_EMAIL_CODE_REQUIRED` | true | 注册是否要邮箱码 |
| `SMTP_*` | — | 邮件发送（留空走 dev devCode 模式） |
| `CORS_ORIGINS` | `http://localhost:38838` | 允许的前端域名 CSV |

## 部署

详见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 开发约定

- **金额一律 USD decimal(18,6)**，前端 `formatCurrency` 默认 `$`
- **错误响应**：`{"message":"中文提示","code":"snake_case"}` + HTTP 状态码
- **分页响应**：`{"items":[...], "total":n, "page":1, "pageSize":20}`
- **decimal 序列化**：`decimal.MarshalJSONWithoutQuotes=true`，前端拿到的是 number
- **审计**：任何写操作 / 安全事件都要 `audit.Emit(...)`，密钥字段脱敏为 `***`
- **不写**：注释解释 WHAT；多行 docstring；README/decisions 类临时文档

## License

MIT
