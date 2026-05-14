import { useMemo } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, RadioTower, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ChannelStatus = "online" | "degraded" | "offline";
type Channel = { name: string; status: ChannelStatus; latency: number; group: string };

const channels: Channel[] = [
  { name: "OpenAI · GPT-5", status: "online", latency: 312, group: "对话" },
  { name: "OpenAI · GPT-4o", status: "online", latency: 245, group: "对话" },
  { name: "Anthropic · Claude Sonnet 4.6", status: "online", latency: 280, group: "对话" },
  { name: "Anthropic · Claude Opus 4.7", status: "online", latency: 410, group: "对话" },
  { name: "Google · Gemini 2.5 Pro", status: "degraded", latency: 820, group: "对话" },
  { name: "DeepSeek · V3", status: "online", latency: 195, group: "对话" },
  { name: "Moonshot · Kimi K2", status: "online", latency: 220, group: "对话" },
  { name: "Alibaba · Qwen 3 Max", status: "online", latency: 175, group: "对话" },
  { name: "OpenAI · DALL·E 3", status: "online", latency: 1820, group: "图像" },
  { name: "OpenAI · Sora-2", status: "online", latency: 4200, group: "图像" },
  { name: "OpenAI · Whisper", status: "online", latency: 540, group: "音频" },
];

const statusMeta: Record<
  ChannelStatus,
  {
    label: string;
    color: string;
    Icon: typeof CheckCircle2;
    badge: "success" | "warning" | "danger";
    panel: string;
    iconBg: string;
    bar: string;
  }
> = {
  online: {
    label: "正常",
    color: "text-success",
    Icon: CheckCircle2,
    badge: "success",
    panel: "border-success/20 bg-success/[0.04]",
    iconBg: "bg-success/10",
    bar: "bg-success",
  },
  degraded: {
    label: "缓慢",
    color: "text-warning",
    Icon: AlertTriangle,
    badge: "warning",
    panel: "border-warning/25 bg-warning/[0.06]",
    iconBg: "bg-warning/10",
    bar: "bg-warning",
  },
  offline: {
    label: "故障",
    color: "text-danger",
    Icon: XCircle,
    badge: "danger",
    panel: "border-danger/25 bg-danger/[0.06]",
    iconBg: "bg-danger/10",
    bar: "bg-danger",
  },
};

export default function StatusPage() {
  const summary = useMemo(() => {
    const online = channels.filter((c) => c.status === "online").length;
    const degraded = channels.filter((c) => c.status === "degraded").length;
    const offline = channels.filter((c) => c.status === "offline").length;
    const total = channels.length;
    const averageLatency = Math.round(channels.reduce((sum, c) => sum + c.latency, 0) / total);
    const ok = offline === 0 && degraded === 0;
    return { online, degraded, offline, total, averageLatency, ok };
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, Channel[]>();
    for (const c of channels) {
      const list = map.get(c.group) ?? [];
      list.push(c);
      map.set(c.group, list);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
      <div className="mb-10 text-center">
        <h1 data-reveal className="text-3xl md:text-5xl font-semibold">
          服务状态
        </h1>
        <p data-reveal data-delay="100" className="mt-3 text-muted-foreground">
          实时监测各上游渠道的可用性与延迟,每 60 秒刷新一次。
        </p>
      </div>

      <Card data-reveal data-delay="200" className="overflow-hidden border-border/80 bg-card/95 shadow-2xl shadow-black/5">
        <CardHeader className={summary.ok ? "bg-success/[0.04]" : "bg-warning/[0.06]"}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <span className={summary.ok ? "grid size-11 shrink-0 place-items-center rounded-lg bg-success/10 text-success" : "grid size-11 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning"}>
                {summary.ok ? <CheckCircle2 className="size-6" /> : <AlertTriangle className="size-6" />}
              </span>
              <div>
                <CardTitle className="text-xl">
                  {summary.ok ? "所有系统运行正常" : "部分系统存在异常"}
                </CardTitle>
                <CardDescription className="mt-1">
                  {summary.online} / {summary.total} 个渠道正常
                  {summary.degraded > 0 && ` · ${summary.degraded} 个缓慢`}
                  {summary.offline > 0 && ` · ${summary.offline} 个故障`}
                </CardDescription>
              </div>
            </div>
            <Badge variant={summary.ok ? "success" : "warning"} className="w-fit">
              60s 自动刷新
            </Badge>
          </div>
        </CardHeader>

        <div className="grid gap-3 border-y bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <PanelMetric icon={RadioTower} label="监测渠道" value={summary.total} hint="全部上游" />
          <PanelMetric icon={CheckCircle2} label="正常渠道" value={summary.online} hint="可稳定调用" tone="success" />
          <PanelMetric icon={Clock3} label="平均延迟" value={`${summary.averageLatency}ms`} hint="当前采样" tone="warning" />
          <PanelMetric icon={Activity} label="异常渠道" value={summary.degraded + summary.offline} hint="需关注" tone={summary.ok ? "success" : "warning"} />
        </div>

        <CardContent className="space-y-4 p-4 md:p-6">
          {groups.map(([group, items], idx) => {
            const groupOffline = items.filter((item) => item.status === "offline").length;
            const groupDegraded = items.filter((item) => item.status === "degraded").length;
            const groupState: ChannelStatus = groupOffline > 0 ? "offline" : groupDegraded > 0 ? "degraded" : "online";
            const groupMeta = statusMeta[groupState];
            const averageLatency = Math.round(items.reduce((sum, item) => sum + item.latency, 0) / items.length);

            return (
              <section
                key={group}
                data-reveal
                data-delay={String((idx + 3) * 100)}
                className="rounded-lg border bg-background/60 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold">{group}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {items.length} 个渠道 · 平均延迟 {averageLatency} ms
                    </p>
                  </div>
                  <Badge variant={groupMeta.badge} className="w-fit">
                    {groupMeta.label}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((channel) => (
                    <ChannelCard key={channel.name} channel={channel} />
                  ))}
                </div>
              </section>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

function PanelMetric({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  hint: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : tone === "danger"
          ? "bg-danger/10 text-danger"
          : "bg-primary/10 text-primary";

  return (
    <div className="rounded-lg border bg-background/75 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        </div>
        <span className={`grid size-9 place-items-center rounded-lg ${toneClass}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function ChannelCard({ channel }: { channel: Channel }) {
  const meta = statusMeta[channel.status];
  const Icon = meta.Icon;
  const healthWidth = Math.max(14, Math.min(100, 100 - channel.latency / 50));

  return (
    <div className={`rounded-lg border p-4 transition-colors ${meta.panel}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid size-8 shrink-0 place-items-center rounded-md ${meta.iconBg}`}>
            <Icon className={`size-4 ${meta.color}`} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{channel.name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{channel.group}</div>
          </div>
        </div>
        <Badge variant={meta.badge}>{meta.label}</Badge>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">响应延迟</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {channel.latency}
            <span className="ml-1 text-xs font-normal text-muted-foreground">ms</span>
          </div>
        </div>
        <div className="mb-1 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${healthWidth}%` }} />
        </div>
      </div>
    </div>
  );
}
