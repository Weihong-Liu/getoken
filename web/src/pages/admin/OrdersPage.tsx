import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { demoOrders } from "@/lib/mockAdmin";
import { formatCurrency, timeAgo } from "@/lib/utils";

const statusMap = {
  paid: { label: "已支付", variant: "success" as const },
  pending: { label: "待支付", variant: "warning" as const },
  cancelled: { label: "已取消", variant: "secondary" as const },
};

const channelMap: Record<string, string> = {
  alipay: "支付宝",
  wxpay: "微信",
  usdt: "USDT",
};

export default function OrdersPage() {
  const totalPaid = demoOrders.filter((o) => o.status === "paid").reduce((s, o) => s + o.amount, 0);

  return (
    <>
      <PageHeader
        title="订单管理"
        description={`累计已支付订单金额:${formatCurrency(totalPaid)}`}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>订单号</TableHead>
              <TableHead>用户</TableHead>
              <TableHead className="text-right">金额</TableHead>
              <TableHead>支付方式</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {demoOrders.map((o) => (
              <TableRow key={o.id}>
                <TableCell><code className="text-xs font-mono">{o.id}</code></TableCell>
                <TableCell>{o.user}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatCurrency(o.amount)}</TableCell>
                <TableCell>{channelMap[o.channel] ?? o.channel}</TableCell>
                <TableCell><Badge variant={statusMap[o.status].variant}>{statusMap[o.status].label}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{timeAgo(o.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
