import {
  Activity,
  CheckCircle2,
  Clock3,
  Gauge,
  RadioTower,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AvailabilityStatus = "online" | "degraded";

type AvailabilityProbe = {
  vendor: "Claude" | "GPT" | "Gemini";
  model: string;
  status: AvailabilityStatus;
  requestLatency: number;
  endpointPing: number;
  availability: number;
  success: number;
  total: number;
  history: AvailabilityStatus[];
};

const probeHistory = (status: AvailabilityStatus, flips: number[] = []) =>
  Array.from({ length: 36 }, (_, index) => (flips.includes(index) ? (status === "online" ? "degraded" : "online") : status));

const availabilityProbes: AvailabilityProbe[] = [
  {
    vendor: "Claude",
    model: "claude-sonnet-4-6",
    status: "online",
    requestLatency: 248,
    endpointPing: 212,
    availability: 99.92,
    success: 1219,
    total: 1220,
    history: probeHistory("online", [9]),
  },
  {
    vendor: "GPT",
    model: "gpt-5",
    status: "online",
    requestLatency: 286,
    endpointPing: 234,
    availability: 99.89,
    success: 1218,
    total: 1220,
    history: probeHistory("online", [18, 31]),
  },
  {
    vendor: "Gemini",
    model: "gemini-2.5-pro",
    status: "degraded",
    requestLatency: 820,
    endpointPing: 641,
    availability: 98.7,
    success: 1204,
    total: 1220,
    history: probeHistory("degraded", [3, 12, 24, 30]),
  },
];

const availabilityTone: Record<
  AvailabilityStatus,
  {
    label: string;
    Icon: typeof CheckCircle2;
    badge: string;
    text: string;
    bar: string;
  }
> = {
  online: {
    label: "正常",
    Icon: CheckCircle2,
    badge: "border-primary/20 bg-primary/10 text-primary",
    text: "text-primary",
    bar: "bg-primary",
  },
  degraded: {
    label: "缓慢",
    Icon: TriangleAlert,
    badge: "border-warning/20 bg-warning/10 text-warning",
    text: "text-warning",
    bar: "bg-warning",
  },
};

export default function AvailabilityPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-16 md:px-6 md:pb-12 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p data-reveal className="text-sm font-medium text-primary">可用性检测</p>
          <h1 data-reveal data-delay="100" className="mt-2 text-4xl font-semibold md:text-5xl">
            像定价方案一样清楚,直接看三条核心线路
          </h1>
          <p data-reveal data-delay="200" className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Claude Code、GPT 和 Gemini 的延迟、端点 Ping、可用率和探测历史都收在同一块面板里。
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
        <Card data-reveal data-delay="200" className="overflow-hidden border-border/80 bg-card/95 shadow-2xl shadow-black/5">
          <CardHeader className="bg-primary/[0.04]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Activity className="size-6" />
                </span>
                <div>
                  <CardTitle className="text-xl">核心上游可用性</CardTitle>
                  <CardDescription className="mt-1">
                    同定价页一致的卡片面板,用于快速判断当前是否适合切量。
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="w-fit">
                  <Sparkles className="size-3.5" />
                  实时探测
                </Badge>
                <span className="text-xs text-muted-foreground">更新于 2026/05/18 10:12:09</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 md:p-6">
            <div className="grid gap-4 lg:grid-cols-3">
              {availabilityProbes.map((probe, index) => (
                <AvailabilityProbeCard key={probe.model} probe={probe} index={index} />
              ))}
            </div>
          </CardContent>

          <div className="grid gap-3 border-t bg-muted/20 p-4 sm:grid-cols-3">
            <AvailabilityMetric icon={Gauge} label="整体状态" value="部分降级" />
            <AvailabilityMetric icon={RadioTower} label="在线上游" value="2 / 3" />
            <AvailabilityMetric icon={Clock3} label="刷新策略" value="5 min" />
          </div>
        </Card>
      </section>
    </>
  );
}

function AvailabilityMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/75 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        </div>
        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}

function AvailabilityProbeCard({ probe, index }: { probe: AvailabilityProbe; index: number }) {
  const tone = availabilityTone[probe.status];
  const Icon = tone.Icon;
  const highlighted = probe.status === "online" && index === 1;

  return (
    <article
      data-reveal
      data-delay={String((index + 1) * 100)}
      className={`relative flex min-h-[360px] flex-col rounded-lg border bg-background/75 p-5 transition-colors ${
        highlighted ? "border-primary/50 bg-primary/[0.05] shadow-lg shadow-primary/10" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{probe.vendor}</div>
          <p className="mt-1 min-h-10 font-mono text-xs leading-6 text-muted-foreground">{probe.model}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.badge}`}>
          <Icon className="size-3.5" />
          {tone.label}
        </span>
      </div>

      <div className="mt-6 flex items-baseline gap-2">
        <span className={`text-4xl font-semibold tracking-normal tabular-nums ${tone.text}`}>
          {probe.availability.toFixed(2)}%
        </span>
        <span className="text-sm text-muted-foreground">7 天可用性</span>
      </div>

      <div className="mt-6 h-px bg-border" />

      <ul className="mt-6 flex-1 space-y-3">
        <li className="flex items-start gap-2 text-sm leading-6">
          <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" />
          <span>请求延迟 {probe.requestLatency} ms</span>
        </li>
        <li className="flex items-start gap-2 text-sm leading-6">
          <RadioTower className="mt-1 size-4 shrink-0 text-primary" />
          <span>端点 Ping {probe.endpointPing} ms</span>
        </li>
        <li className="flex items-start gap-2 text-sm leading-6">
          <Gauge className="mt-1 size-4 shrink-0 text-primary" />
          <span>{probe.success}/{probe.total} 次探测成功</span>
        </li>
      </ul>

      <div className="mt-6 rounded-lg border bg-card/70 p-3">
        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>近 60 次探测</span>
          <span className="inline-flex items-center gap-1 normal-case tracking-normal">
            <Clock3 className="size-3" />
            1m 33s 后更新
          </span>
        </div>
        <div className="mt-3 flex h-6 items-stretch gap-1">
          {probe.history.map((point, index) => (
            <span
              key={`${probe.model}-${index}`}
              className={`min-w-0 flex-1 rounded-[2px] ${availabilityTone[point].bar}`}
              title={`${index + 1}: ${availabilityTone[point].label}`}
            />
          ))}
        </div>
      </div>

      {highlighted && (
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      )}
    </article>
  );
}
