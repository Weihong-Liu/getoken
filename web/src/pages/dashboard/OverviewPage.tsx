import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import type { LiquidConfig } from "@ant-design/plots";
import {
  Activity,
  ArrowRight,
  Cpu,
  Gauge,
  RadioTower,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { fetcher, type DashboardStats } from "@/lib/api";
import { demoStats } from "@/lib/mock";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const providerHealth = [
  { name: "OpenAI", model: "GPT-5 / GPT-4o", latency: "245ms", uptime: "99.99%", load: 88, status: "正常" },
  { name: "Anthropic", model: "Claude Sonnet", latency: "280ms", uptime: "99.95%", load: 82, status: "正常" },
  { name: "Gemini", model: "Gemini 2.5 Pro", latency: "820ms", uptime: "98.70%", load: 54, status: "缓慢" },
];

const LiquidChart = lazy(() => import("@ant-design/plots").then((module) => ({ default: module.Liquid })));

const quickLinks = [
  { label: "API Keys", to: "/dashboard/tokens", icon: ShieldCheck },
  { label: "调用日志", to: "/dashboard/logs", icon: Activity },
  { label: "充值", to: "/dashboard/topup", icon: Wallet },
];

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return formatCurrency(value);
}

type LiquidThemeColors = {
  primary: string;
  primaryEnd: string;
  card: string;
  border: string;
};

const liquidThemeFallback: LiquidThemeColors = {
  primary: "#6abe39",
  primaryEnd: "#14b8a6",
  card: "#0d1010",
  border: "#202727",
};

function readLiquidThemeColors(): LiquidThemeColors {
  if (typeof window === "undefined") return liquidThemeFallback;

  const styles = getComputedStyle(document.documentElement);
  const read = (token: string, fallback: string) => styles.getPropertyValue(token).trim() || fallback;

  return {
    primary: read("--primary", liquidThemeFallback.primary),
    primaryEnd: read("--primary-end", liquidThemeFallback.primaryEnd),
    card: read("--card", liquidThemeFallback.card),
    border: read("--border", liquidThemeFallback.border),
  };
}

function useLiquidThemeColors() {
  const [colors, setColors] = useState<LiquidThemeColors>(readLiquidThemeColors);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setColors(readLiquidThemeColors());
    const observer = new MutationObserver(update);

    update();
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-accent"] });
    window.addEventListener("storage", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", update);
    };
  }, []);

  return colors;
}

export default function OverviewPage() {
  const { user } = useAuth();
  const { data } = useSWR<DashboardStats>("/stats?range=14d", fetcher, {
    fallbackData: demoStats,
    revalidateOnFocus: false,
  });

  const stats = data ?? demoStats;
  const balancePercent = Math.max(0.18, Math.min(0.7, stats.balance / 140));
  const username = user?.username || user?.email?.split("@")[0] || "开发者";

  return (
    <>
      <PageHeader
        title={`你好, ${username}`}
        description="额度、调用、渠道健康和快速接入集中在这里,打开控制台就能判断今天的运行情况。"
        actions={
          <Button asChild>
            <Link to="/dashboard/topup"><Wallet />充值</Link>
          </Button>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <BalancePanel stats={stats} balancePercent={balancePercent} />

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard title="今日消费" value={formatCurrency(stats.usedToday)} icon={TrendingUp} tone="warning" hint="较昨日平稳" />
          <StatCard title="今日请求" value={formatNumber(stats.requestsToday)} icon={Activity} tone="success" hint="实时聚合" />
          <StatCard title="可用模型" value="80+" icon={Cpu} hint="对话 / 图像 / 音频" />
          <StatCard title="路由状态" value="99.92%" icon={RadioTower} tone="success" hint="多上游自动切换" />
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="dashboard-panel overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 bg-muted/20">
            <div>
              <CardTitle>近 14 天调用趋势</CardTitle>
              <CardDescription>请求数 / 消耗 token</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard/logs">详细日志 <ArrowRight className="size-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.series} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overview-requests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.38} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    stroke="var(--primary)"
                    strokeWidth={2.4}
                    fill="url(#overview-requests)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-panel">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>上游健康</CardTitle>
                <CardDescription className="mt-1">核心渠道实时概览</CardDescription>
              </div>
              <Badge variant="success">自动路由</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {providerHealth.map((item) => (
              <div key={item.name} className="rounded-lg border bg-background/55 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{item.name}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{item.model}</div>
                  </div>
                  <Badge variant={item.status === "正常" ? "success" : "warning"}>{item.status}</Badge>
                </div>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{item.latency}</span>
                    <span className="mx-2">/</span>
                    {item.uptime}
                  </div>
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${item.load}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="dashboard-panel">
          <CardHeader>
            <CardTitle>Top 模型</CardTitle>
            <CardDescription>近 14 天调用最多的模型</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.topModels.map((m, i) => {
              const max = stats.topModels[0]?.requests || 1;
              const pct = (m.requests / max) * 100;
              return (
                <div key={m.name} className="rounded-lg border bg-background/55 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-mono text-xs">
                      <span className="mr-2 text-muted-foreground">#{i + 1}</span>
                      {m.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">{formatNumber(m.requests)} 请求</span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="dashboard-panel overflow-hidden">
          <CardHeader className="border-b border-border/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>快速接入</CardTitle>
                <CardDescription className="mt-1">OpenAI 兼容,直接替换 base_url 即可</CardDescription>
              </div>
              <Badge variant="secondary"><Zap className="size-3.5" />即刻可用</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_0.82fr]">
            <pre className="min-h-60 overflow-x-auto rounded-lg bg-neutral-950 p-4 font-mono text-xs leading-relaxed text-neutral-200">
{`from openai import OpenAI

client = OpenAI(
    base_url="https://api.getoken.cc/v1",
    api_key="sk-getoken-xxxxxxxx",
)

resp = client.chat.completions.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True,
)`}
            </pre>
            <div className="grid content-start gap-3">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Button key={item.to} asChild variant="outline" className="h-14 justify-start rounded-lg">
                    <Link to={item.to}>
                      <Icon className="size-4 text-primary" />
                      {item.label}
                      <ArrowRight className="ml-auto size-4 text-muted-foreground" />
                    </Link>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function BalancePanel({ stats, balancePercent }: { stats: DashboardStats; balancePercent: number }) {
  const liquidColors = useLiquidThemeColors();
  const liquidConfig = useMemo<LiquidConfig>(
    () => ({
      percent: balancePercent,
      autoFit: true,
      height: 176,
      padding: 0,
      tooltip: false,
      legend: false,
      style: {
        shape: "circle",
        fill: liquidColors.primary,
        fillOpacity: 0.88,
        opacity: 0.96,
        backgroundFill: liquidColors.card,
        backgroundFillOpacity: 0.36,
        backgroundStrokeOpacity: 0,
        outlineBorder: 0,
        outlineDistance: 0,
        outlineStrokeOpacity: 0,
        waveCount: 3,
        waveLength: 92,
        contentText: "",
        contentFill: "transparent",
        contentFillOpacity: 0,
      },
    }),
    [balancePercent, liquidColors.border, liquidColors.card, liquidColors.primary],
  );

  return (
    <Card className="dashboard-panel overflow-hidden">
      <CardContent className="grid gap-6 p-5 md:grid-cols-[240px_1fr] md:items-center">
        <div className="flex justify-center md:justify-start">
          <div className="liquid-meter size-48">
            <div className="liquid-plot" aria-hidden="true">
              <Suspense fallback={<div className="liquid-fallback" />}>
                <LiquidChart {...liquidConfig} />
              </Suspense>
            </div>
            <div className="absolute inset-0 z-10 grid place-items-center text-center">
              <div>
                <div className="text-xs text-foreground/70">账户余额</div>
                <div className="mt-2 text-3xl font-semibold tabular-nums tracking-normal">{formatCompactCurrency(stats.balance)}</div>
                <div className="mt-1 text-xs text-foreground/70">永久有效</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <Badge variant="secondary"><Gauge className="size-3.5" />余额水波图</Badge>
          <h2 className="mt-4 text-2xl font-semibold">余额状态充足</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            水位按当前余额动态呈现,结合今日消费和请求量,可以快速判断是否需要充值或调整业务限额。
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-background/55 p-3">
              <div className="text-xs text-muted-foreground">今日消费</div>
              <div className="mt-2 text-lg font-semibold tabular-nums">{formatCurrency(stats.usedToday)}</div>
            </div>
            <div className="rounded-lg border bg-background/55 p-3">
              <div className="text-xs text-muted-foreground">今日请求</div>
              <div className="mt-2 text-lg font-semibold tabular-nums">{formatNumber(stats.requestsToday)}</div>
            </div>
            <div className="rounded-lg border bg-background/55 p-3">
              <div className="text-xs text-muted-foreground">可用天数</div>
              <div className="mt-2 text-lg font-semibold tabular-nums">20+</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
