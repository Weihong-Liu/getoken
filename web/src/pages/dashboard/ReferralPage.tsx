import { useState } from "react";
import { Copy, Users2, Coins, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { copyToClipboard, formatCurrency } from "@/lib/utils";

export default function ReferralPage() {
  const { user } = useAuth();
  const code = user?.inviteCode ?? "GETOKEN8";
  const url = `${window.location.origin}/register?invite=${code}`;
  const [referrals] = useState([
    { email: "dev***@gmail.com", joinedAt: "2026-04-12", totalSpend: 320, reward: 16 },
    { email: "ai***@163.com", joinedAt: "2026-04-08", totalSpend: 180, reward: 9 },
    { email: "test***@qq.com", joinedAt: "2026-03-29", totalSpend: 50, reward: 2.5 },
  ]);

  return (
    <>
      <PageHeader title="邀请返利" description="邀请好友注册并消费,你将获得他消费金额的 5% 作为返利。" />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="累计邀请" value={referrals.length} icon={Users2} />
        <StatCard title="累计返利" value={formatCurrency(referrals.reduce((s, r) => s + r.reward, 0))} icon={Coins} tone="success" />
        <StatCard title="本月新增" value="2" icon={TrendingUp} tone="warning" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>你的邀请链接</CardTitle>
          <CardDescription>分享给好友,你和他都将获得额外奖励。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={url} className="font-mono text-xs" />
            <Button variant="outline" onClick={() => { copyToClipboard(url); toast.success("已复制邀请链接"); }}>
              <Copy />复制
            </Button>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground">邀请码:</span>
            <code className="text-sm font-mono px-2 py-0.5 rounded bg-muted">{code}</code>
            <Button variant="ghost" size="icon" onClick={() => { copyToClipboard(code); toast.success("已复制邀请码"); }}>
              <Copy />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>邀请明细</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>被邀请人</TableHead>
              <TableHead>加入时间</TableHead>
              <TableHead className="text-right">累计消费</TableHead>
              <TableHead className="text-right">已获返利</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referrals.map((r) => (
              <TableRow key={r.email}>
                <TableCell className="font-mono text-xs">{r.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.joinedAt}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.totalSpend)}</TableCell>
                <TableCell className="text-right tabular-nums text-success">{formatCurrency(r.reward)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
