import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Gauge,
  RadioTower,
  RefreshCw,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { site } from "@/lib/site";

type ProbeStatus = "online" | "degraded" | "offline";
type Vendor = "Anthropic" | "OpenAI" | "Google";
type Probe = {
  title: string;
  vendor: Vendor;
  model: string;
  group: string;
  status: ProbeStatus;
  requestLatency: number;
  endpointLatency: number;
  availability: number;
  success: number;
  total: number;
  history: ProbeStatus[];
};

const history = (mode: ProbeStatus, flips: number[] = []) =>
  Array.from({ length: 60 }, (_, index) => (flips.includes(index) ? (mode === "online" ? "degraded" : "online") : mode));

const probes: Probe[] = [
  {
    title: "Claude Sonnet 4.6",
    vendor: "Anthropic",
    model: "claude-sonnet-4-6",
    group: "对话 / 代码",
    status: "online",
    requestLatency: 248,
    endpointLatency: 212,
    availability: 99.92,
    success: 1219,
    total: 1220,
    history: history("online", [9]),
  },
  {
    title: "GPT-5",
    vendor: "OpenAI",
    model: "gpt-5",
    group: "对话 / 推理",
    status: "online",
    requestLatency: 286,
    endpointLatency: 234,
    availability: 99.89,
    success: 1218,
    total: 1220,
    history: history("online", [18, 43]),
  },
  {
    title: "Gemini 2.5 Pro",
    vendor: "Google",
    model: "gemini-2.5-pro",
    group: "长上下文",
    status: "degraded",
    requestLatency: 820,
    endpointLatency: 641,
    availability: 98.7,
    success: 1204,
    total: 1220,
    history: history("degraded", [2, 4, 12, 28, 35, 49]),
  },
  {
    title: "Claude Haiku 4.5",
    vendor: "Anthropic",
    model: "claude-haiku-4-5",
    group: "低延迟",
    status: "online",
    requestLatency: 226,
    endpointLatency: 220,
    availability: 99.86,
    success: 1218,
    total: 1220,
    history: history("online", [31]),
  },
  {
    title: "Gemini 2.5 Flash",
    vendor: "Google",
    model: "gemini-2.5-flash",
    group: "轻量 / 备用",
    status: "online",
    requestLatency: 214,
    endpointLatency: 175,
    availability: 99.91,
    success: 1219,
    total: 1220,
    history: history("online", [14]),
  },
];

const statusTone: Record<
  ProbeStatus,
  {
    label: string;
    summary: string;
    dot: string;
    badge: string;
    text: string;
    history: string;
    Icon: typeof CheckCircle2;
  }
> = {
  online: {
    label: "正常",
    summary: "可调用",
    dot: "bg-success",
    badge: "border-success/20 bg-success/10 text-success",
    text: "text-success",
    history: "bg-success",
    Icon: CheckCircle2,
  },
  degraded: {
    label: "缓慢",
    summary: "自动降级",
    dot: "bg-warning",
    badge: "border-warning/20 bg-warning/10 text-warning",
    text: "text-warning",
    history: "bg-warning",
    Icon: TriangleAlert,
  },
  offline: {
    label: "故障",
    summary: "暂停路由",
    dot: "bg-danger",
    badge: "border-danger/20 bg-danger/10 text-danger",
    text: "text-danger",
    history: "bg-danger",
    Icon: TriangleAlert,
  },
};

const rangeOptions = ["7 天", "15 天", "30 天"];

export default function StatusPage() {
  useTheme();

  const summary = useMemo(() => {
    const online = probes.filter((probe) => probe.status === "online").length;
    const degraded = probes.filter((probe) => probe.status === "degraded").length;
    const offline = probes.filter((probe) => probe.status === "offline").length;
    const avgAvailability = probes.reduce((sum, probe) => sum + probe.availability, 0) / probes.length;
    const avgLatency = Math.round(probes.reduce((sum, probe) => sum + probe.requestLatency, 0) / probes.length);
    const state: ProbeStatus = offline > 0 ? "offline" : degraded > 0 ? "degraded" : "online";

    return { online, degraded, offline, total: probes.length, avgAvailability, avgLatency, state };
  }, []);

  const currentTone = statusTone[summary.state];

  return (
    <section className="relative isolate min-h-screen overflow-hidden bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in srgb, var(--border) 44%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--border) 36%, transparent) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          background:
            "radial-gradient(circle at 20% 0%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 42%), radial-gradient(circle at 78% 16%, color-mix(in srgb, var(--primary-end) 10%, transparent), transparent 34%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[1500px] px-4 pb-24 pt-10 md:px-6 lg:px-10">
        <Link
          to="/"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border/70 bg-card/65 px-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          返回首页
        </Link>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Activity className="size-5" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">GeToken Availability</span>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-normal text-foreground md:text-6xl">可用性检测</h1>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">模型聚合</span>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">智能路由</span>
              <span className="rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">{site.domain}</span>
            </div>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
              实时追踪 GeToken 聚合网关、模型上游和 API 端点健康状态。异常渠道会进入降级路由,请求自动切换到可用备用通道。
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
              <SummaryPill tone="online" text={`${summary.online} 正常`} />
              {summary.degraded > 0 && <SummaryPill tone="degraded" text={`${summary.degraded} 缓慢`} />}
              {summary.offline > 0 && <SummaryPill tone="offline" text={`${summary.offline} 故障`} />}
              <span className="h-4 w-px bg-border/70" />
              <span className="text-muted-foreground">{summary.total} 个核心上游</span>
            </div>
          </div>

          <div className="flex flex-col items-start gap-4 lg:items-end">
            <div className="inline-flex items-center rounded-full border border-border/70 bg-card/65 p-1 text-xs text-muted-foreground">
              <span className="px-3">统计区间</span>
              {rangeOptions.map((item, index) => (
                <button
                  key={item}
                  className={
                    index === 0
                      ? "rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground"
                      : "rounded-full px-3 py-1 transition-colors hover:text-foreground"
                  }
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>

            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${currentTone.badge}`}>
              <span className={`size-3 rounded-full ${currentTone.dot} shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_55%,transparent)]`} />
              {summary.state === "online" ? "整体运行正常" : summary.state === "degraded" ? "部分渠道降级" : "存在故障渠道"}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <HeaderMetric label="平均可用性" value={`${summary.avgAvailability.toFixed(2)}%`} />
              <HeaderMetric label="平均延迟" value={`${summary.avgLatency} ms`} />
              <HeaderMetric label="刷新策略" value="5 分钟" />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground lg:justify-end">
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="size-3.5" />
                更新于 2026/05/17 10:11:29
              </span>
              <Link to="/pricing" className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 transition-colors hover:border-primary/40 hover:text-foreground">
                查看模型价格 <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <OverviewTile icon={Gauge} label="网关状态" value={currentTone.summary} tone={summary.state} />
          <OverviewTile icon={RadioTower} label="在线上游" value={`${summary.online}/${summary.total}`} tone="online" />
          <OverviewTile icon={Clock3} label="探测周期" value="5 min" tone="online" />
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {probes.map((probe) => (
            <ProbeCard key={probe.model} probe={probe} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SummaryPill({ tone, text }: { tone: ProbeStatus; text: string }) {
  const meta = statusTone[tone];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.badge}`}>
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {text}
    </span>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 rounded-lg border border-border/60 bg-card/65 px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold text-foreground tabular-nums">{value}</div>
    </div>
  );
}

function OverviewTile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: ProbeStatus }) {
  const meta = statusTone[tone];

  return (
    <div className="rounded-xl border border-border/70 bg-card/75 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
        </div>
        <span className={`grid size-10 place-items-center rounded-lg border ${meta.badge}`}>
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}

function ProbeCard({ probe }: { probe: Probe }) {
  const meta = statusTone[probe.status];
  const Icon = meta.Icon;

  return (
    <article className="rounded-xl border border-border/70 bg-card/80 p-5 shadow-2xl shadow-black/5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-normal text-foreground">{probe.title}</h2>
          <div className="mt-4 flex items-center gap-3">
            <ProviderIcon vendor={probe.vendor} />
            <span className="rounded-lg bg-muted/80 px-2.5 py-1 text-sm font-medium text-foreground/80">{probe.vendor}</span>
            <span className="truncate font-mono text-sm text-muted-foreground">{probe.model}</span>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.badge}`}>
          <Icon className="size-3.5" />
          {meta.label}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <MetricTile icon={Activity} label="请求延迟" value={probe.requestLatency} />
        <MetricTile icon={RadioTower} label="端点 Ping" value={probe.endpointLatency} />
      </div>

      <div className="mt-5 rounded-lg border border-border/50 bg-background/55 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground">7 天可用性</div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              {probe.success}/{probe.total} 次探测成功
            </div>
          </div>
          <div className={`text-lg font-semibold tabular-nums ${meta.text}`}>{probe.availability.toFixed(2)}%</div>
        </div>
      </div>

      <div className="mt-6 border-t border-border/45 pt-5">
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">近 60 次探测</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
            <Clock3 className="size-3.5" />
            1m 33s 后更新
          </span>
        </div>

        <div className="mt-4 flex h-8 items-stretch gap-1">
          {probe.history.map((point, index) => (
            <span
              key={`${probe.model}-${index}`}
              className={`min-w-0 flex-1 rounded-[2px] ${statusTone[point].history}`}
              title={`${index + 1}: ${statusTone[point].label}`}
            />
          ))}
        </div>

        <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          <span>过去</span>
          <span>现在</span>
        </div>
      </div>
    </article>
  );
}

function ProviderIcon({ vendor }: { vendor: Vendor }) {
  const label = {
    Anthropic: "A",
    OpenAI: "O",
    Google: "G",
  }[vendor];

  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted/80 text-lg font-bold text-foreground/80">
      {label}
    </span>
  );
}

function MetricTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/45 bg-background/55 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-2 text-xl font-medium tabular-nums text-foreground">
        {value}
        <span className="ml-1.5 text-sm font-normal text-muted-foreground">ms</span>
      </div>
    </div>
  );
}
