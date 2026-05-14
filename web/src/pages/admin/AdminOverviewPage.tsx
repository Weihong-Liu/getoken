import useSWR from "swr";
import { Users2, Wallet, Activity, Server } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { fetcher, type DashboardStats } from "@/lib/api";
import { demoStats } from "@/lib/mock";
import { demoAdminChannels } from "@/lib/mockAdmin";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/utils";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export default function AdminOverviewPage() {
  const { data } = useSWR<DashboardStats>("/admin/stats", fetcher, {
    fallbackData: demoStats,
    revalidateOnFocus: false,
  });
  const stats = data ?? demoStats;

  return (
    <>
      <PageHeader title="管理总览" description="平台运营状态一览。" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="注册用户" value="1,238" icon={Users2} hint="本周 +52" />
        <StatCard title="今日收入" value={formatCurrency(2148.5)} icon={Wallet} tone="success" />
        <StatCard title="今日请求" value={formatNumber(86_320)} icon={Activity} tone="warning" />
        <StatCard title="在线渠道" value="6 / 8" icon={Server} hint="2 个异常" tone="danger" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>近 14 天请求量</CardTitle>
          <CardDescription>全平台聚合数据</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.series}>
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
                <Bar dataKey="requests" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>渠道健康度</CardTitle>
          <CardDescription>最近一次心跳检测结果</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {demoAdminChannels.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <div className={`size-2 rounded-full ${c.status === "online" ? "bg-success" : c.status === "degraded" ? "bg-warning" : "bg-danger"}`} />
                <span className="text-sm font-medium">{c.name}</span>
                <Badge variant="secondary" className="font-mono text-[10px]">{c.type}</Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{c.keys} keys</span>
                <span className="tabular-nums">{c.latencyMs > 0 ? `${c.latencyMs}ms` : "—"}</span>
                <span>{timeAgo(Date.now() - 60_000)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
