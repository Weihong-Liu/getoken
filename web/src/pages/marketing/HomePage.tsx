import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Code2,
  Gauge,
  KeyRound,
  Layers,
  LineChart,
  LockKeyhole,
  Network,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Capability = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

const heroStats = [
  { label: "可用渠道", value: "120+" },
  { label: "最低倍率", value: "0.2x" },
  { label: "在线率", value: "99.92%" },
  { label: "余额有效期", value: "永久" },
];

const capabilities: Capability[] = [
  {
    icon: Network,
    title: "统一中转入口",
    desc: "OpenAI 兼容协议,Claude / GPT / Gemini 三条核心线路统一接入。",
  },
  {
    icon: Workflow,
    title: "智能渠道路由",
    desc: "按模型、用户分组、倍率和可用性自动切换上游,支持权重、重试和熔断。",
  },
  {
    icon: KeyRound,
    title: "API Key 精细管理",
    desc: "每个 key 可独立配置额度、过期时间、IP 白名单、模型权限和限速。",
  },
  {
    icon: BarChart3,
    title: "用量计费透明",
    desc: "按 token 计费,余额、请求、失败率、模型消耗和账单明细实时可查。",
  },
  {
    icon: ShieldCheck,
    title: "风控与安全策略",
    desc: "异常调用、暴力请求、超额消费自动拦截,后台可一键冻结问题令牌。",
  },
  {
    icon: Activity,
    title: "可用性面板与告警",
    desc: "持续探测渠道延迟和可用性,异常自动通知,首页面板降低支持成本。",
  },
];

const operationModules = [
  { icon: Wallet, title: "充值与卡密", desc: "在线充值、卡密兑换、余额流水、邀请返利。" },
  { icon: Layers, title: "模型价格表", desc: "模型分组、倍率配置、上下文和价格公开展示。" },
  { icon: LineChart, title: "调用日志", desc: "请求 ID、耗时、token、错误码和上游命中全链路追踪。" },
  { icon: LockKeyhole, title: "管理后台", desc: "用户、渠道、模型、分组、订单、公告和系统设置完整闭环。" },
];

const routeRows = [
  { model: "claude-sonnet-4-6", vendor: "Anthropic", status: "online", latency: "212ms", rate: "0.72x", width: "92%" },
  { model: "gpt-5", vendor: "OpenAI", status: "online", latency: "248ms", rate: "0.88x", width: "78%" },
  { model: "gemini-2.5-pro", vendor: "Google", status: "busy", latency: "640ms", rate: "0.46x", width: "52%" },
];

const models = [
  "Claude Code",
  "Claude Sonnet 4.6",
  "Claude Opus 4.7",
  "GPT-5",
  "GPT-5 Mini",
  "GPT-4o",
  "Gemini 2.5 Pro",
  "Gemini 2.5 Flash",
  "Gemini 2.0 Flash",
];

const faqs = [
  {
    q: "我需要改很多代码吗?",
    a: "不需要。OpenAI 兼容项目通常只要替换 base_url 和 api_key;Claude、Gemini 等接口也可以按原协议透传。",
  },
  {
    q: "余额和 token 怎么计费?",
    a: "按 prompt + completion 的实际 token 消耗计费,不同模型拥有独立倍率,充值后的余额永久有效。",
  },
  {
    q: "渠道异常时会影响业务吗?",
    a: "系统会持续检测上游可用性,遇到超时、限流或错误会按策略切换备用渠道,并在日志和可用性面板中记录。",
  },
  {
    q: "后台功能够不够完整?",
    a: "包含用户、渠道、模型、分组、API Key、订单、卡密、公告、日志和系统设置,适合直接运营一个中转站。",
  },
];

export default function HomePage() {
  return (
    <div className="relative isolate overflow-hidden bg-background">
      <section className="relative z-10 text-foreground">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" aria-hidden />

        <div className="relative mx-auto w-full max-w-[920px] px-4 pb-16 pt-10 md:px-6 md:pb-20 md:pt-14">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
            <Badge variant="outline" className="max-w-full border-border bg-muted/50 px-3 py-1 text-[11px] shadow-sm sm:text-xs">
              <span className="size-1.5 rounded-full bg-primary" />
              渠道在线 · token 计费
            </Badge>

            <h1 data-reveal className="mt-6 text-3xl font-semibold leading-[1.08] min-[360px]:text-4xl md:text-5xl lg:text-6xl">
              GeToken
              <span className="block text-foreground/92">一个入口,</span>
              <span
                className="block bg-clip-text text-transparent"
                style={{
                  backgroundImage: "linear-gradient(90deg, var(--primary), var(--primary-end), var(--primary-start))",
                }}
              >
                <span className="block 2xl:inline">接入 Claude Code</span>
                <span className="hidden 2xl:inline"> </span>
                <span className="block 2xl:inline">与 GPT-5</span>
              </span>
            </h1>

            <p data-reveal data-delay="100" className="mx-auto mt-6 max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
              参考 tabcode.cc 的暗色科技感,但把中转站运营需要的能力补全:
              模型聚合、渠道路由、API Key、充值计费、日志监控、可用性面板和管理后台。
            </p>

            <div data-reveal data-delay="200" className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="xl">
                <Link to="/register">
                  前往控制台 <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl">
                <Link to="/pricing">查看定价</Link>
              </Button>
            </div>

            <div data-reveal data-delay="300" className="mx-auto mt-12 grid w-full max-w-3xl grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {heroStats.map((stat) => (
                <div key={stat.label} className="border-l border-border px-4 first:border-l-0">
                  <div className="text-2xl font-semibold tabular-nums md:text-3xl">{stat.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div data-reveal data-delay="200" className="relative mt-12 w-full max-w-[920px]">
            <div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-2xl shadow-primary/10">
              <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-danger/85" />
                  <span className="size-2.5 rounded-full bg-warning/85" />
                  <span className="size-2.5 rounded-full bg-primary/85" />
                </div>
                <span className="text-xs text-muted-foreground">GeToken Control Plane</span>
              </div>

              <div className="grid gap-4 p-4 min-[1180px]:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">实时路由</div>
                      <div className="mt-1 text-lg font-semibold">Multi-provider gateway</div>
                    </div>
                    <Badge className="border border-primary/20 bg-primary/10 text-primary">99.92%</Badge>
                  </div>

                  <div className="mt-5 space-y-3">
                    {routeRows.map((row) => (
                      <div key={row.model} className="rounded-lg border bg-card p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-xs text-foreground/85">{row.model}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{row.vendor} · {row.rate}</div>
                          </div>
                          <div className="text-right">
                            <div className={row.status === "online" ? "text-xs text-primary" : "text-xs text-warning"}>
                              {row.status}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">{row.latency}</div>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/10">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: row.width,
                              backgroundImage: "linear-gradient(90deg, var(--primary), var(--primary-end))",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Wallet className="size-4 text-primary" />
                      账户余额
                    </div>
                    <div className="mt-4 text-3xl font-semibold tabular-nums">$ 2,486.38</div>
                    <div className="mt-2 text-xs text-muted-foreground">今日消耗 $37.82 · 余额永久有效</div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className="inline-flex items-center gap-2">
                        <Gauge className="size-4 text-primary" />
                        今日请求
                      </span>
                      <span className="text-primary">+18%</span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Metric label="Requests" value="48.2K" />
                      <Metric label="Tokens" value="19.6M" />
                    </div>
                  </div>

                  <div className="rounded-lg border bg-neutral-950 p-4 text-neutral-100">
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <Terminal className="size-4 text-primary" />
                      OpenAI compatible
                    </div>
                    <pre className="mt-3 overflow-x-auto text-xs leading-6 text-neutral-200">
{`base_url = "https://api.getoken.cc/v1"
model = "claude-sonnet-4-6"
stream = true`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
              {["SSE 流式响应", "失败自动重试", "IP 白名单"].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  <span className="truncate">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[920px] px-4 py-16 md:px-6 md:py-24">
        <SectionHeading
          eyebrow="核心能力"
          title="不只是好看的落地页,而是一套能运营的中转站"
          desc="把用户购买、开发接入、管理员运维和故障处理这些真实流程放在同一个产品里。"
        />

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((item, index) => (
            <div
              key={item.title}
              data-reveal
              data-delay={String(((index % 3) + 1) * 100)}
              className="group rounded-lg border bg-card p-6 transition-colors hover:border-primary/45"
            >
              <div className="grid size-10 place-items-center rounded-lg border bg-background text-primary">
                <item.icon className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-muted/35">
        <div className="mx-auto grid max-w-[920px] gap-8 px-4 py-16 md:px-6 md:py-24 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionHeading
              align="left"
              eyebrow="接入体验"
              title="改一行 base_url,剩下交给路由和监控"
              desc="开发者看到的是稳定兼容的 API,运营者看到的是清晰可控的后台。"
            />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {operationModules.map((item) => (
                <div key={item.title} className="rounded-lg border bg-card p-5">
                  <item.icon className="size-5 text-primary" />
                  <h3 className="mt-4 font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div data-reveal data-delay="200" className="rounded-lg border bg-neutral-950 text-neutral-100 shadow-xl shadow-neutral-950/10">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="inline-flex items-center gap-2 text-sm">
                <Code2 className="size-4 text-primary" />
                快速调用
              </span>
              <Badge variant="outline" className="border-white/15 text-white">curl</Badge>
            </div>
            <pre className="overflow-x-auto p-5 text-xs leading-7 text-neutral-300 md:p-6 md:text-sm">
{`curl https://api.getoken.cc/v1/chat/completions \\
  -H "Authorization: Bearer sk-getoken-xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5",
    "stream": true,
    "messages": [
      { "role": "user", "content": "介绍一下 GeToken" }
    ]
  }'`}
            </pre>
            <div className="grid border-t border-white/10 md:grid-cols-3">
              {["OpenAI SDK", "Claude 透传", "Gemini 兼容"].map((item) => (
                <div key={item} className="border-white/10 px-5 py-4 text-sm text-neutral-300 md:border-r last:md:border-r-0">
                  <CheckCircle2 className="mb-2 size-4 text-primary" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[920px] px-4 py-16 md:px-6 md:py-24">
        <SectionHeading
          eyebrow="模型矩阵"
          title="主流模型和场景,统一放进一个余额池"
          desc="先聚焦 Claude Code、GPT 和 Gemini 三类高频模型,按分组开放给不同用户。"
        />

        <div data-reveal data-delay="200" className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {models.map((model) => (
            <div key={model} className="flex h-14 items-center justify-center rounded-lg border bg-card px-3 text-center text-sm font-medium transition-colors hover:border-primary/45">
              {model}
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {[
            { value: "30s", label: "创建一个带额度限制的 API Key" },
            { value: "60s", label: "查看用户、模型、渠道的调用成本" },
            { value: "1min", label: "发现异常渠道并自动下线切换" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border bg-card p-6">
              <div className="text-3xl font-semibold text-primary">{item.value}</div>
              <p className="mt-3 text-sm text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-muted/35">
        <div className="mx-auto max-w-[920px] px-4 py-16 md:px-6 md:py-24">
          <SectionHeading eyebrow="常见问题" title="上线前最关心的几件事" desc="围绕接入、计费、稳定性和后台能力做清楚回答。" />
          <div className="mt-10 space-y-3">
            {faqs.map((item, index) => (
              <details
                key={item.q}
                data-reveal
                data-delay={String(((index % 4) + 1) * 100)}
                className="group rounded-lg border bg-card p-5"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium">
                  {item.q}
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-background">
        <div className="mx-auto max-w-[920px] px-4 py-16 md:px-6 md:py-24">
          <div
            data-reveal
            className="relative grid gap-8 overflow-hidden rounded-lg border bg-card p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 55%), radial-gradient(circle at 100% 100%, color-mix(in srgb, var(--primary-end) 14%, transparent), transparent 55%)",
              }}
            />
            <div className="relative">
              <p className="inline-flex items-center gap-2 text-sm text-primary">
                <Sparkles className="size-4" />
                现在就可以把中转站跑起来
              </p>
              <h2 className="mt-3 text-3xl font-semibold md:text-4xl">
                从落地页到控制台,用户注册后立刻能接入。
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                首页负责建立信任,定价页负责转化,可用性面板负责透明,控制台负责留存和复购。
              </p>
            </div>
            <div className="relative flex flex-col gap-3 sm:flex-row md:flex-col">
              <Button asChild size="xl">
                <Link to="/register">免费开始 <ArrowRight className="size-4" /></Link>
              </Button>
              <Button asChild variant="outline" size="xl">
                <a href="https://docs.getoken.cc" target="_blank" rel="noopener noreferrer">阅读文档</a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  desc,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  desc: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <p data-reveal className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 data-reveal data-delay="100" className="mt-3 text-2xl font-semibold leading-tight [overflow-wrap:anywhere] md:text-3xl">
        {title}
      </h2>
      <p data-reveal data-delay="200" className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
        {desc}
      </p>
    </div>
  );
}
