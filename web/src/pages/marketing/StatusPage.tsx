import { useMemo } from "react";
import useSWR from "swr";
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
import { fetcher, type StatusInfo } from "@/lib/api";
import { site } from "@/lib/site";
import { timeAgo } from "@/lib/utils";

type ProbeStatus = StatusInfo["upstreams"][number]["status"];

const statusTone: Record<
  ProbeStatus,
  {
    label: string;
    summary: string;
    dot: string;
    badge: string;
    text: string;
    Icon: typeof CheckCircle2;
  }
> = {
  online: {
    label: "正常",
    summary: "可调用",
    dot: "bg-success",
    badge: "border-success/20 bg-success/10 text-success",
    text: "text-success",
    Icon: CheckCircle2,
  },
  degraded: {
    label: "缓慢",
    summary: "自动降级",
    dot: "bg-warning",
    badge: "border-warning/20 bg-warning/10 text-warning",
    text: "text-warning",
    Icon: TriangleAlert,
  },
  offline: {
    label: "故障",
    summary: "暂停路由",
    dot: "bg-danger",
    badge: "border-danger/20 bg-danger/10 text-danger",
    text: "text-danger",
    Icon: TriangleAlert,
  },
};

const EMPTY_UPSTREAMS: StatusInfo["upstreams"] = [];

export default function StatusPage() {
  useTheme();
  const { data, isLoading } = useSWR<StatusInfo>("/public/status", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: false,
  });
  const upstreams = data?.upstreams ?? EMPTY_UPSTREAMS;

  const summary = useMemo(() => {
    const online = upstreams.filter((probe) => probe.status === "online").length;
    const degraded = upstreams.filter((probe) => probe.status === "degraded").length;
    const offline = upstreams.filter((probe) => probe.status === "offline").length;
    const measured = upstreams.filter((probe) => probe.latencyMs > 0);
    const avgLatency = measured.length > 0
      ? Math.round(measured.reduce((sum, probe) => sum + probe.latencyMs, 0) / measured.length)
      : 0;
    const state: ProbeStatus = offline > 0 ? "offline" : degraded > 0 ? "degraded" : "online";

    return { online, degraded, offline, total: upstreams.length, avgLatency, state };
  }, [upstreams]);

  const currentTone = statusTone[summary.state];
  const updatedAt = data?.updatedAt ? timeAgo(data.updatedAt) : "等待后端返回";

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
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">真实上游</span>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">后端探测</span>
              <span className="rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">{site.domain}</span>
            </div>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
              状态数据来自 GeToken 后端公开状态接口,展示当前上游网关的在线、降级、离线和最近探测延迟。
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
              <SummaryPill tone="online" text={`${summary.online} 正常`} />
              {summary.degraded > 0 && <SummaryPill tone="degraded" text={`${summary.degraded} 缓慢`} />}
              {summary.offline > 0 && <SummaryPill tone="offline" text={`${summary.offline} 故障`} />}
              <span className="h-4 w-px bg-border/70" />
              <span className="text-muted-foreground">{summary.total} 个上游</span>
            </div>
          </div>

          <div className="flex flex-col items-start gap-4 lg:items-end">
            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${currentTone.badge}`}>
              <span className={`size-3 rounded-full ${currentTone.dot}`} />
              {summary.state === "online" ? "整体运行正常" : summary.state === "degraded" ? "部分渠道降级" : "存在故障渠道"}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <HeaderMetric label="在线上游" value={`${summary.online}/${summary.total}`} />
              <HeaderMetric label="平均延迟" value={summary.avgLatency > 0 ? `${summary.avgLatency} ms` : "-"} />
              <HeaderMetric label="刷新策略" value="30 秒" />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground lg:justify-end">
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="size-3.5" />
                更新于 {updatedAt}
              </span>
              <Link to="/pricing" className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 transition-colors hover:border-primary/40 hover:text-foreground">
                查看模型价格 <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <OverviewTile icon={Gauge} label="网关状态" value={currentTone.summary} tone={summary.state} />
          <OverviewTile icon={RadioTower} label="在线上游" value={`${summary.online}/${summary.total}`} tone={summary.state} />
          <OverviewTile icon={Clock3} label="自动刷新" value="30s" tone="online" />
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {isLoading && (
            <div className="rounded-xl border border-border/70 bg-card/80 p-8 text-center text-sm text-muted-foreground">
              正在加载上游状态
            </div>
          )}
          {!isLoading && upstreams.length === 0 && (
            <div className="rounded-xl border border-border/70 bg-card/80 p-8 text-center text-sm text-muted-foreground">
              后端暂未返回上游状态
            </div>
          )}
          {upstreams.map((probe) => (
            <UpstreamCard key={probe.id} probe={probe} />
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

function UpstreamCard({ probe }: { probe: StatusInfo["upstreams"][number] }) {
  const meta = statusTone[probe.status];
  const Icon = meta.Icon;

  return (
    <article className="rounded-xl border border-border/70 bg-card/80 p-5 shadow-2xl shadow-black/5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-normal text-foreground">{probe.name}</h2>
          <div className="mt-4 flex items-center gap-3">
            <ProviderIcon label={probe.type || probe.name} />
            <span className="rounded-lg bg-muted/80 px-2.5 py-1 text-sm font-medium text-foreground/80">{probe.type || "upstream"}</span>
            <span className="font-mono text-sm text-muted-foreground">#{probe.id}</span>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.badge}`}>
          <Icon className="size-3.5" />
          {meta.label}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <MetricTile icon={Activity} label="探测延迟" value={probe.latencyMs > 0 ? `${probe.latencyMs} ms` : "-"} />
        <MetricTile icon={RadioTower} label="最近检测" value={probe.lastCheckAt ? timeAgo(probe.lastCheckAt) : "未检测"} />
      </div>

      <div className="mt-5 rounded-lg border border-border/50 bg-background/55 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground">当前调度状态</div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">来自 /api/public/status</div>
          </div>
          <div className={`text-lg font-semibold tabular-nums ${meta.text}`}>{meta.summary}</div>
        </div>
      </div>
    </article>
  );
}

function ProviderIcon({ label }: { label: string }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted/80 text-lg font-bold uppercase text-foreground/80">
      {label.trim().charAt(0) || "U"}
    </span>
  );
}

function MetricTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/45 bg-background/55 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-2 text-xl font-medium tabular-nums text-foreground">{value}</div>
    </div>
  );
}
