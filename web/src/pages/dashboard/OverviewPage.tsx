import useSWR from "swr";
import { Wallet, Zap, Activity, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function OverviewPage() {
  const { user } = useAuth();
  const { data } = useSWR<DashboardStats>("/stats?range=14d", fetcher, {
    fallbackData: demoStats,
    revalidateOnFocus: false,
  });

  const stats = data ?? demoStats;

  return (
    <>
      <PageHeader
        title={`你好,${user?.email?.split("@")[0] ?? "开发者"} 👋`}
        description="一站式查看你的额度、调用与近期使用情况。"
        actions={
          <Button asChild>
            <Link to="/dashboard/topup"><Wallet />充值</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="账户余额" value={formatCurrency(stats.balance)} icon={Wallet} hint="充值后永久有效" />
        <StatCard title="今日消费" value={formatCurrency(stats.usedToday)} icon={TrendingUp} tone="warning" />
        <StatCard title="今日请求" value={formatNumber(stats.requestsToday)} icon={Activity} tone="success" />
        <StatCard title="可用模型" value="80+" icon={Zap} hint="支持 OpenAI 兼容调用" />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>近 14 天调用趋势</CardTitle>
            <CardDescription>请求数 / 消耗 token</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/logs">查看详细日志 <ArrowRight className="size-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.series} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="reqs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
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
                  strokeWidth={2}
                  fill="url(#reqs)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Top 模型</CardTitle>
            <CardDescription>近 14 天调用最多的模型</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.topModels.map((m, i) => {
              const max = stats.topModels[0]?.requests || 1;
              const pct = (m.requests / max) * 100;
              return (
                <div key={m.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs">
                      <span className="text-muted-foreground mr-2">#{i + 1}</span>
                      {m.name}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{formatNumber(m.requests)} 请求</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>快速接入</CardTitle>
            <CardDescription>OpenAI 兼容,直接替换 base_url 即可</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="rounded-lg bg-neutral-950 text-neutral-200 p-4 text-xs font-mono leading-relaxed overflow-x-auto">
{`from openai import OpenAI

client = OpenAI(
    base_url="https://api.getoken.cc/v1",
    api_key="sk-getoken-xxxxxxxx",
)

resp = client.chat.completions.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": "Hello"}],
)`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
