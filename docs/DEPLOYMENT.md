# GeToken 部署手册

## 架构与端口

```
┌─────────────┐    HTTPS    ┌────────────┐    /api/*    ┌─────────────┐    sk-上游     ┌──────────────┐
│  浏览器     │ ──────────► │  Caddy /   │ ───────────► │  getoken    │ ────────────► │  上游网关    │
│  / SDK      │             │  Nginx     │              │  Go server  │               │  (new-api    │
│             │             │            │ ────────────►│  :38883     │               │   sub2api …) │
└─────────────┘             └────────────┘   /v1/*      └─────────────┘               └──────────────┘
                                                              │
                                                              ▼
                                                ┌───────────────────────────┐
                                                │  Postgres 16 · Redis 7    │
                                                └───────────────────────────┘
```

- **Web**：纯静态 SPA，由 Caddy / Nginx 直接 serve `web/dist`
- **API + 转发**：单个 Go 二进制，监听 38883
- **DB**：Postgres 16（必须）+ Redis 7（必须，用于 JWT 黑名单、邮箱验证码缓存）
- **依赖外部**：SMTP（可选，用于注册/找回密码邮件）、至少一个上游 API 服务（new-api / sub2api / OpenAI 官方）

## 一、Docker Compose 部署（推荐）

适合单机 / 小流量场景，最简单。

### 1. 准备目录与配置

```bash
git clone https://github.com/<your-org>/getoken.git
cd getoken/server
cp .env.example .env
```

编辑 `server/.env`，至少改：

```ini
HTTP_ADDR=:38883
ENV=production
DATABASE_URL=postgres://getoken:getoken@postgres:5432/getoken?sslmode=disable
REDIS_ADDR=redis:6379

# 用 openssl rand -hex 32 生成
JWT_SECRET=<64 字符随机串>

ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<强密码>

# 留空 → 注册时 dev 模式回显验证码；上线务必填上
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM=GeToken <noreply@yourdomain.com>

# 你的前端域名（多个用逗号分隔）
CORS_ORIGINS=https://app.yourdomain.com
```

### 2. 启动后端 + DB + Redis

```bash
cd server
docker compose up -d --build
docker compose logs -f app    # 看到 "http server listening :38883" 即 OK
```

`docker-compose.yml` 已经把 Postgres 数据卷挂到 `pgdata` 卷，重启不丢数据。

### 3. 构建前端静态产物

```bash
cd ../web
pnpm install --frozen-lockfile
VITE_API_BASE_URL=https://api.yourdomain.com/api pnpm build
# 产物在 web/dist
```

> `VITE_API_BASE_URL` 是前端调 API 的绝对前缀。**也可以**不指定（默认 `/api`），让前端走相对路径，由反向代理转发到后端——见下文 Caddy 示例。

### 4. 反向代理 Caddy 示例

```caddy
# /etc/caddy/Caddyfile

app.yourdomain.com {
    encode zstd gzip
    root * /var/www/getoken
    file_server
    try_files {path} /index.html

    # 后端 API（共享同一个 host，前端发请求到 /api/* 自动转发）
    handle_path /api/* {
        reverse_proxy 127.0.0.1:38883
    }

    # LLM 转发；SSE 必须关掉 buffer
    handle_path /v1/* {
        reverse_proxy 127.0.0.1:38883 {
            flush_interval -1
            transport http {
                read_timeout 600s
            }
        }
    }
}
```

把 `web/dist/*` 同步到 `/var/www/getoken/`，重启 Caddy 即可：

```bash
rsync -av --delete web/dist/ root@server:/var/www/getoken/
sudo systemctl reload caddy
```

### 5. Nginx 等价示例

```nginx
server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;
    ssl_certificate     /etc/letsencrypt/live/.../fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;

    root /var/www/getoken;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:38883;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /v1/ {
        proxy_pass http://127.0.0.1:38883;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection "";
        proxy_buffering off;          # SSE 流式必须
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

## 二、裸机 / systemd 部署

### 1. 构建二进制

```bash
cd server
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /usr/local/bin/getoken ./cmd/getoken
```

### 2. systemd unit

`/etc/systemd/system/getoken.service`:

```ini
[Unit]
Description=GeToken backend
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=getoken
WorkingDirectory=/opt/getoken
EnvironmentFile=/opt/getoken/.env
ExecStart=/usr/local/bin/getoken
Restart=on-failure
RestartSec=3
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd -r -d /opt/getoken -s /usr/sbin/nologin getoken
sudo mkdir -p /opt/getoken
sudo cp server/.env /opt/getoken/.env
sudo chown -R getoken:getoken /opt/getoken

sudo systemctl daemon-reload
sudo systemctl enable --now getoken
sudo journalctl -u getoken -f
```

数据库迁移**自动在启动时跑**，无需手动 goose。

### 3. Postgres / Redis

- 推荐版本：Postgres 16+、Redis 7+
- 创建库：

```sql
CREATE USER getoken WITH PASSWORD 'change-me';
CREATE DATABASE getoken OWNER getoken;
```

- Redis 建议设密码并通过 `REDIS_PASSWORD` 注入。

## 三、Kubernetes 部署提示

不在本仓库提供 manifest，但要点：

1. Server 是无状态的，水平扩缩容随意。**JWT 黑名单走 Redis**，多副本天然一致。
2. 一定要把 Postgres / Redis 作为外部服务（Cloud SQL / RDS / ElastiCache 等），不要塞进 Pod。
3. **SSE 长连接**：Ingress / LB 的 idle timeout 至少调到 600s。NGINX Ingress 加 `proxy_buffering: "false"`。
4. Pod liveness/readiness：`GET /healthz` 即可。
5. 数据库迁移在容器启动时自动跑——多副本上滚时确保串行启动（StatefulSet 或 init-container），否则会同时跑 goose 引起死锁。最简单做法：用一个独立的 `migrate` Job 先跑完，再启动 Deployment。

## 四、生产前 Checklist

- [ ] `.env.JWT_SECRET` 已换成 ≥32 字符的随机串
- [ ] `ADMIN_PASSWORD` 已改成强密码，登录后立刻 `/dashboard/settings` 再改一次
- [ ] `CORS_ORIGINS` 只允许真实前端域名
- [ ] HTTPS 强制 + HSTS（Caddy / Nginx 配置）
- [ ] Postgres 设置每日备份（`pg_dump getoken | gzip > daily-$(date +%F).sql.gz`）
- [ ] Redis 持久化策略至少 RDB（AOF 更稳）
- [ ] SMTP 真实可用，注册流程能收到验证码邮件
- [ ] 系统设置「邀请返利」百分比已配
- [ ] 至少配 1 个上游 + 通过「导入内置模型」灌入默认价格表
- [ ] 已建测试卡密 + 测试 token，端到端跑通一次 `/v1/chat/completions`
- [ ] 监控 / 日志收集（journalctl / docker logs / k8s logs → ELK / Loki）
- [ ] 升级流程：`git pull && docker compose up -d --build` 或 重新构建二进制 + `systemctl restart getoken`；迁移自动跑

## 五、升级与回滚

### 升级

```bash
cd getoken
git fetch && git checkout v1.x.x

# Backend
cd server && docker compose up -d --build

# Frontend
cd ../web && pnpm install && pnpm build
rsync -av --delete dist/ /var/www/getoken/
```

迁移会自增到最新版本（goose 自动判断）。**不会丢数据**。

### 回滚

```bash
# 1. 切回旧版本镜像
git checkout v1.x.0
cd server && docker compose up -d

# 2. 如果新版本有 schema 变更要回退（罕见）：
docker compose exec app /app/getoken migrate down --to <version>
```

**注意**：`goose down` 会执行 migration 的 Down 部分，可能丢数据。生产回滚前先备份。

## 六、监控关键指标

| 指标 | 含义 |
|---|---|
| `users_total` | 注册用户总数 |
| `requests_today` | 今日 API 请求数（admin/stats） |
| `revenue_today` | 今日收入（即兑换总额） |
| 5xx 错误率 | 上游不可达 / getoken 自身错误 |
| `/v1/*` p95 延迟 | 转发性能 |
| 上游 last_check_at | 上游网关健康度（待 cron 探测落地） |

## 常见排错

| 现象 | 排查 |
|---|---|
| `connection refused` 调上游 | 检查 `upstreams.baseUrl`（不要带 `/v1`） |
| `model_not_found` | 模型 status=offline 或不在 model_mappings |
| `invalid_api_key` | `sk-getoken-*` 输错 / 被禁 / 已删除 |
| `quota_exhausted` | 用户余额或 token.remain_quota = 0；要么充值要么把 token 改成"无限额度" |
| `403 ip_not_allowed` | token 的 IP 白名单没匹配到 |
| 兑换卡密无返利 | `invite.rewardPercent` 未设；且返利只在**真实调用消费**时触发，**兑换时不返利**（设计如此） |
| SSE 流断断续续 | Caddy/Nginx 没关 buffer；K8s ingress idle timeout 太短 |
| 重启后审计噪声 "no current client" | tmux 配置问题，与 server 无关 |

## License

MIT
