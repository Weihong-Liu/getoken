# GeToken

AI API 聚合中转站前端 —— 视觉风格对齐 [tabcode.cc](https://tabcode.cc),包含落地页、认证流、用户控制台与管理后台。

后端独立部署,前端通过 `VITE_API_BASE_URL` 指向你的后端服务即可。

## 技术栈

- **Vite 8** + **React 19** + **TypeScript 6**
- **Tailwind CSS v4** (CSS-first 配置,支持深浅双主题)
- **React Router v7** + **SWR** + **react-hook-form** + **zod**
- **Radix UI** primitives + **shadcn 风格**自建组件
- **Recharts** 图表 / **Sonner** toast / **Lucide** 图标
- 滚动入场动画基于 IntersectionObserver(`data-reveal`)

## 目录结构

```
web/
├── src/
│   ├── main.tsx                      # 入口
│   ├── routes/router.tsx             # 全部路由集中配置
│   ├── styles/globals.css            # Tailwind + 主题变量
│   ├── components/
│   │   ├── ui/                       # Button/Card/Dialog/Table/...
│   │   ├── marketing/                # Header/Footer/Logo/ThemeToggle
│   │   └── dashboard/                # 控制台 Layout / RequireAuth / StatCard
│   ├── pages/
│   │   ├── marketing/                # 首页 / 定价 / 状态
│   │   ├── auth/                     # 登录 / 注册 / 找回密码
│   │   ├── dashboard/                # 用户控制台 6 个页面
│   │   └── admin/                    # 管理后台 10 个页面
│   ├── hooks/                        # useAuth / useTheme / useReveal
│   └── lib/
│       ├── api.ts                    # fetch 封装 + 类型
│       ├── mock.ts / mockAdmin.ts    # Demo 数据(无后端时也能预览)
│       ├── site.ts                   # 站点常量
│       └── utils.ts                  # cn / formatXxx
├── index.html
├── vite.config.ts                    # 含 /api 代理配置
└── tsconfig.app.json                 # @/* path alias
```

## 页面清单

**落地页(公开)**

- `/` 首页:Hero + 数据卡片 + 代码示例 + 核心能力 + 模型矩阵 + 用户之声 + FAQ + CTA
- `/pricing` 定价:三档套餐 + 模型价格表(分组切换 + 搜索)
- `/status` 状态:渠道健康度,按分组展示

**认证**

- `/login` 登录
- `/register` 注册(邮箱验证码 + 邀请码)
- `/forgot` 找回密码

**用户控制台**(`/dashboard/*`,需登录)

- 总览 · 余额 / 用量趋势 / Top 模型 / 代码示例
- API Keys · 创建/启用/禁用/复制/IP 白名单/额度
- 调用日志 · 多维筛选 + CSV 导出
- 充值 · 在线支付(支付宝/微信/USDT)+ 卡密兑换
- 邀请返利 · 邀请链接 + 明细
- 账户设置 · 资料 / 安全 / 通知

**管理后台**(`/admin/*`,需管理员身份)

- 总览 · 收入 / 请求量图表 / 渠道健康度
- 用户管理 · 列表 / 角色 / 分组 / 封禁
- 渠道管理 · 多 key 轮询 / 优先级 / 权重 / 健康检测
- 模型管理 · 价格倍率 / 开放分组 / 上下架
- 分组管理 · 倍率与可用渠道
- 调用日志
- 卡密管理 · 批量生成 / 导出
- 订单管理
- 公告管理
- 系统设置 · 站点 / 邮件 / 支付 / 安全 / 邀请返利

## 后端 API 约定

前端默认请求 `/api/*`,响应体形如:

```jsonc
{ "data": { ... } }       // 200 解包后返回 data
{ "message": "...", "code": 400 }  // 非 200 抛 ApiError
```

主要 endpoint(详见 `src/lib/api.ts`):

| 方法   | 路径                  | 说明                |
| ------ | --------------------- | ------------------- |
| POST   | /auth/login           | 邮箱密码登录        |
| POST   | /auth/register        | 注册(邮箱+验证码)|
| POST   | /auth/send-code       | 发送邮箱验证码      |
| POST   | /auth/forgot          | 重置密码            |
| GET    | /user/self            | 当前用户            |
| PUT    | /user/self            | 更新资料            |
| PUT    | /user/password        | 修改密码            |
| GET    | /token                | API Key 列表        |
| POST   | /token                | 创建 API Key        |
| PUT    | /token/:id            | 更新                |
| DELETE | /token/:id            | 删除                |
| GET    | /log                  | 调用日志(分页)   |
| GET    | /stats?range=14d      | 用户用量统计        |
| POST   | /topup/redeem         | 卡密兑换            |
| POST   | /topup/order          | 创建充值订单        |
| GET    | /admin/stats          | 管理员总览统计      |

> 当后端尚未就绪时,Dashboard / 管理后台会使用 `src/lib/mock*.ts` 的 demo 数据兜底,UI 完全可预览。

## 本地开发

```bash
cd web
pnpm install
pnpm dev          # http://localhost:5173
```

Vite 已经把 `/api/*` 反向代理到 `http://localhost:3000`(可用 `API_PROXY_TARGET` 覆盖)。

## 构建

```bash
pnpm build        # 产物在 web/dist
pnpm preview      # 本地预览构建产物
```

## 主题与品牌

- 颜色变量集中在 `src/styles/globals.css` 的 `:root` / `.dark` 块。改 `--primary` 即可换主色调。
- 站点名 / 文案 / 联系邮箱在 `src/lib/site.ts`。
- Logo 在 `src/components/marketing/Logo.tsx`,favicon 在 `public/favicon.svg`。

## 部署

构建产物是纯静态 SPA,直接用 Nginx / Cloudflare Pages / Vercel 部署即可。

Nginx 示例(支持 React Router 的 history 模式):

```nginx
server {
    listen 80;
    server_name getoken.cc;

    root /var/www/getoken;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 反代到后端
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # SSE 流式响应必须的两项
        proxy_buffering off;
        proxy_read_timeout 600s;
    }
}
```

## License

MIT
