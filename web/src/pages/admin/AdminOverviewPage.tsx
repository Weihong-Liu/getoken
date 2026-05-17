import useSWR from "swr";
import { Users2, Wallet, Activity, Server, BarChart3, Clock3, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { fetcher, type AdminStats } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

type SeriesPoint = AdminStats["series"][number];

const emptyAdminStats: AdminStats = {
  users: 0,
  tokens: 0,
  requestsToday: 0,
  revenueToday: 0,
  series: [],
  topModels: [],
};

export default function AdminOverviewPage() {
  const { data } = useSWR<AdminStats>("/admin/stats", fetcher, {
    revalidateOnFocus: false,
  });
  const stats = data ?? emptyAdminStats;
  const totalRequests = stats.series.reduce((sum, item) => sum + item.requests, 0);
  const totalTokens = stats.series.reduce((sum, item) => sum + item.tokens, 0);
  const peak = stats.series.reduce(
    (best, item) => (item.requests > best.requests ? item : best),
    stats.series[0] ?? { date: "-", requests: 0, tokens: 0, cost: 0 },
  );
  const latest = stats.series[stats.series.length - 1] ?? peak;
  const previous = stats.series[stats.series.length - 2] ?? latest;
  const latestDelta = previous.requests > 0
    ? ((latest.requests - previous.requests) / previous.requests) * 100
    : 0;
  const latestShare = peak.requests > 0 ? Math.min(100, (latest.requests / peak.requests) * 100) : 0;

  return (
    <>
      <PageHeader title="管理总览" description="平台运营状态一览。" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="注册用户" value={formatNumber(stats.users)} icon={Users2} />
        <StatCard title="今日收入" value={formatCurrency(Number(stats.revenueToday))} icon={Wallet} tone="success" />
        <StatCard title="今日请求" value={formatNumber(stats.requestsToday)} icon={Activity} tone="warning" />
        <StatCard title="API Key 总数" value={formatNumber(stats.tokens)} icon={Server} />
      </div>

      <Card className="dashboard-panel mb-6 overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-muted/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <BarChart3 className="size-4" />
                </span>
                <CardTitle>近 14 天请求量</CardTitle>
              </div>
              <CardDescription className="mt-2">全平台聚合数据,按日统计请求、token 和峰值变化。</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary"><Activity className="size-3.5" />{formatNumber(totalRequests)} 请求</Badge>
              <Badge variant="secondary"><Server className="size-3.5" />{formatNumber(totalTokens)} tokens</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 p-5 xl:grid-cols-[1fr_280px]">
          <div className="h-72 rounded-lg border bg-background/55 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.series}
                margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
                accessibilityLayer={false}
              >
                <defs>
                  <linearGradient id="admin-requests-bar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.42} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 8" vertical={false} />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickMargin={12} />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatNumber(Number(value))}
                />
                <Tooltip
                  cursor={false}
                  shared={false}
                  isAnimationActive={false}
                  animationDuration={0}
                  wrapperStyle={{ outline: "none", pointerEvents: "none", transition: "none" }}
                  content={<RequestsTooltip />}
                />
                <Bar
                  dataKey="requests"
                  radius={[8, 8, 3, 3]}
                  barSize={28}
                  fill="url(#admin-requests-bar)"
                  opacity={0.86}
                  activeBar={{ fill: "var(--primary)", opacity: 1 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid content-start gap-3">
            <div className="rounded-lg border bg-background/55 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="size-3.5 text-primary" />
                最新日请求
              </div>
              <div className="mt-3 text-2xl font-semibold tabular-nums">{formatNumber(latest.requests)}</div>
              <div className={latestDelta >= 0 ? "mt-1 text-xs text-success" : "mt-1 text-xs text-danger"}>
                {latestDelta >= 0 ? "+" : ""}{latestDelta.toFixed(1)}% 较前一日
              </div>
            </div>

            <div className="rounded-lg border bg-background/55 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="size-3.5 text-primary" />
                峰值日期
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{peak.date}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatNumber(peak.requests)} 请求</div>
                </div>
                <Badge variant="outline">Peak</Badge>
              </div>
            </div>

            <div className="rounded-lg border bg-background/55 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>今日 / 峰值</span>
                <span>{Math.round(latestShare)}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${latestShare}%` }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 模型</CardTitle>
          <CardDescription>近 14 天请求量靠前的模型</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.topModels.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">还没有请求数据</div>
          )}
          {stats.topModels.map((m) => (
            <div key={m.name} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono">{m.name}</span>
                <Badge variant="secondary" className="text-[10px]">{formatNumber(m.tokens)} tokens</Badge>
              </div>
              <span className="tabular-nums text-xs text-muted-foreground">{formatNumber(m.requests)} 请求</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function RequestsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: SeriesPoint }>;
}) {
  const point = payload?.[0]?.payload;

  if (!active || !point) return null;

  return (
    <div className="rounded-lg border bg-card/95 p-3 text-xs shadow-2xl shadow-black/20">
      <div className="font-medium text-foreground">{point.date}</div>
      <div className="mt-2 grid gap-1 text-muted-foreground">
        <div className="flex items-center justify-between gap-6">
          <span>请求量</span>
          <span className="font-medium tabular-nums text-foreground">{formatNumber(point.requests)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span>Tokens</span>
          <span className="font-medium tabular-nums text-foreground">{formatNumber(point.tokens)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span>消耗</span>
          <span className="font-medium tabular-nums text-foreground">{formatCurrency(point.cost)}</span>
        </div>
      </div>
    </div>
  );
}
