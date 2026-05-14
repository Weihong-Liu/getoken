import useSWR from "swr";
import { Users2, Wallet, Activity, Server } from "lucide-react";
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

export default function AdminOverviewPage() {
  const { data } = useSWR<AdminStats>("/admin/stats", fetcher, {
    revalidateOnFocus: false,
  });
  const stats = data;

  return (
    <>
      <PageHeader title="管理总览" description="平台运营状态一览。" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="注册用户" value={formatNumber(stats?.users ?? 0)} icon={Users2} />
        <StatCard title="今日收入" value={formatCurrency(Number(stats?.revenueToday ?? 0))} icon={Wallet} tone="success" />
        <StatCard title="今日请求" value={formatNumber(stats?.requestsToday ?? 0)} icon={Activity} tone="warning" />
        <StatCard title="API Key 总数" value={formatNumber(stats?.tokens ?? 0)} icon={Server} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>近 14 天请求量</CardTitle>
          <CardDescription>全平台聚合数据</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.series ?? []}>
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
          <CardTitle>Top 模型</CardTitle>
          <CardDescription>近 14 天请求量靠前的模型</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(stats?.topModels ?? []).length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">还没有请求数据</div>
          )}
          {(stats?.topModels ?? []).map((m) => (
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
