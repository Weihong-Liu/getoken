import useSWR from "swr";
import { Activity, AlertTriangle, Gauge, RadioTower, Server, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { fetcher, type AdminOpsAccount, type AdminOpsSnapshot } from "@/lib/api";
import { formatNumber, timeAgo } from "@/lib/utils";

const emptyOpsSnapshot: AdminOpsSnapshot = {
  windowSeconds: 300,
  qps: 0,
  tps: 0,
  requests: 0,
  tokens: 0,
  errors: 0,
  errorRate: 0,
  onlineAccounts: 0,
  degradedAccounts: 0,
  offlineAccounts: 0,
  activeAccountConcurrency: 0,
  activeUserConcurrency: 0,
  updatedAt: new Date(0).toISOString(),
};

export default function OpsPage() {
  const { data: snapshot } = useSWR<AdminOpsSnapshot>("/admin/ops/snapshot?window=300", fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: false,
  });
  const { data: accounts } = useSWR<AdminOpsAccount[]>("/admin/ops/accounts", fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: false,
  });

  const ops = snapshot ?? emptyOpsSnapshot;
  const rows = accounts ?? [];

  return (
    <>
      <PageHeader title="运行监控" description="实时查看 QPS、TPS、账号并发、错误率和账号池健康度。" />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="QPS" value={String(Number(ops.qps).toFixed(2))} icon={Gauge} />
        <StatCard title="TPS" value={formatNumber(Number(ops.tps))} icon={Zap} tone="success" />
        <StatCard title="错误率" value={`${Number(ops.errorRate).toFixed(2)}%`} icon={AlertTriangle} tone={ops.errors > 0 ? "warning" : "success"} />
        <StatCard title="活跃并发" value={formatNumber(ops.activeAccountConcurrency + ops.activeUserConcurrency)} icon={RadioTower} />
      </div>

      <Card className="mb-6">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>窗口快照</CardTitle>
              <CardDescription>近 {ops.windowSeconds} 秒聚合，自动刷新。</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success"><Activity className="size-3.5" />{formatNumber(ops.requests)} 请求</Badge>
              <Badge variant="secondary"><Server className="size-3.5" />{formatNumber(ops.tokens)} tokens</Badge>
              <Badge variant="outline">更新于 {timeAgo(ops.updatedAt)}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          <HealthTile label="在线账号" value={ops.onlineAccounts} tone="success" />
          <HealthTile label="降级账号" value={ops.degradedAccounts} tone="warning" />
          <HealthTile label="离线账号" value={ops.offlineAccounts} tone="danger" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>账号池负载</CardTitle>
          <CardDescription>对齐 sub2api 的账号级调度视图，显示并发、RPM/TPM 限制和最近错误。</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>账号</TableHead>
              <TableHead>上游</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>优先级 / 权重</TableHead>
              <TableHead>并发</TableHead>
              <TableHead>RPM / TPM</TableHead>
              <TableHead>延迟</TableHead>
              <TableHead>最近使用</TableHead>
              <TableHead>错误</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">{account.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{account.upstreamName || `#${account.upstreamId}`}</TableCell>
                <TableCell><StatusBadge status={account.status} /></TableCell>
                <TableCell className="tabular-nums">{account.priority} / {account.weight}</TableCell>
                <TableCell className="tabular-nums">{account.currentConcurrency} / {account.concurrencyLimit || "∞"}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{account.rpmLimit || "∞"} / {account.tpmLimit || "∞"}</TableCell>
                <TableCell className="tabular-nums">{account.latencyMs || "-"} ms</TableCell>
                <TableCell className="text-muted-foreground">{account.lastUsedAt ? timeAgo(account.lastUsedAt) : "—"}</TableCell>
                <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">{account.lastError || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function HealthTile({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "danger" }) {
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-danger";
  return (
    <div className="rounded-lg border bg-background/60 p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${color}`}>{formatNumber(value)}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: AdminOpsAccount["status"] }) {
  if (status === "online") return <Badge variant="success">在线</Badge>;
  if (status === "degraded" || status === "cooling") return <Badge variant="warning">降级</Badge>;
  return <Badge variant="danger">离线</Badge>;
}
