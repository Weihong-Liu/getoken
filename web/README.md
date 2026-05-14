# getoken-web

GeToken 的 React 前端。详见仓库根 [README.md](../README.md) 与 [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)。

## 技术栈

- Vite 8 · React 19 · TypeScript 6
- Tailwind CSS v4（CSS-first，主题变量在 `src/styles/globals.css`）
- React Router v7 · SWR · react-hook-form · zod
- Radix UI primitives + shadcn 风格自建组件（`src/components/ui/*`）
- Recharts 图表 · Sonner toast · Lucide 图标

## 目录结构

```
src/
├── main.tsx                       # 入口
├── routes/router.tsx              # 全部路由集中配置
├── styles/globals.css             # Tailwind + 主题变量
├── lib/
│   ├── api.ts                     # apiFetch + 全部 TS 类型
│   ├── mock.ts / mockAdmin.ts     # 仅用于个别 marketing 页占位（不影响生产）
│   ├── site.ts                    # 站点常量
│   └── utils.ts                   # cn / formatCurrency / maskKey / timeAgo
├── hooks/                         # useAuth / useTheme / useReveal
├── components/
│   ├── ui/                        # Button / Card / Dialog / Table / Select 等
│   ├── marketing/                 # Header / Footer / Logo / ThemeToggle
│   └── dashboard/                 # DashboardLayout / PageHeader / RequireAuth / StatCard
└── pages/
    ├── marketing/                 # 首页 / 定价 / 状态 / 教程
    ├── auth/                      # 登录 / 注册 / 找回密码
    ├── dashboard/                 # 用户：总览 / API Keys / 调用日志 / 充值 / 邀请返利 / 设置
    └── admin/                     # 管理员：总览 / 用户 / 上游 / 模型 / 分组 / 调用日志 / 审计日志 / 卡密 / 公告 / 系统设置
```

## 本地开发

```bash
pnpm install
pnpm dev          # http://localhost:38838
```

`vite.config.ts` 已经把 `/api` 反代到 `http://localhost:38883`（可用 `API_PROXY_TARGET` 覆盖）。

## 与后端联调

- 默认管理员账号见后端 `.env` 的 `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- 登录页有 "填入默认账号" 按钮直接套用
- 注册流程在 `ENV=development` 模式下，发码接口会回显 `devCode` 到响应里，不用配 SMTP

## 构建

```bash
pnpm build        # 产物在 dist/，纯静态可直接发 CDN / Nginx
pnpm preview      # 本地预览构建产物
```

环境变量：

| Key | 默认 | 说明 |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | 后端 API 前缀。同源部署时留空走相对路径；跨域时填完整 `https://api.your-domain.com/api` |

## 主题与品牌

- 颜色变量集中在 `src/styles/globals.css` 的 `:root` / `.dark` 块，改 `--primary` 即可换主色调
- 站点名 / 文案 / 联系邮箱在 `src/lib/site.ts`
- Logo 在 `src/components/marketing/Logo.tsx`，favicon 在 `public/favicon.svg`

## 调用日志列说明

`/dashboard/logs` 与 `/admin/logs` 的表格列：

| 列 | 含义 |
|---|---|
| 输入 | 未命中缓存的 prompt tokens |
| 缓存 | 缓存命中的 prompt tokens（按 cachedPrice 折扣计费） |
| 写缓存 | 写入新缓存的 tokens（Anthropic cache_creation） |
| 输出 | completion tokens |
| 思考 | reasoning_effort 标签（low/medium/high/...）+ 实际推理消耗 token |
| 消耗 | 本次扣费 USD |
| 延迟 | 端到端 ms |

## 货币与精度

- 全站金额单位 USD
- `formatCurrency` 默认 `$` 前缀
- 后端 decimal(18,6) 通过 `decimal.MarshalJSONWithoutQuotes=true` 序列化为 JSON number，前端 `number` 类型直接接收

## 部署

构建产物为纯静态，直接发 Nginx / Caddy / Cloudflare Pages / Vercel。详见 [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)。
