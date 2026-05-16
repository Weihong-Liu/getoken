import useSWR from "swr";
import { Copy, Users2, Coins, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { fetcher, type Referrals } from "@/lib/api";
import { demoReferrals } from "@/lib/mock";
import { copyToClipboard, formatCurrency } from "@/lib/utils";

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, 3);
  return `${head}***${domain}`;
}

export default function ReferralPage() {
  const { data } = useSWR<Referrals>("/user/referrals", fetcher, {
    fallbackData: demoReferrals,
    revalidateOnFocus: false,
  });

  const code = data?.inviteCode ?? "";
  const url = code ? `${window.location.origin}/register?invite=${code}` : "";
  const stats = data?.stats ?? { invitees: 0, totalReward: 0, monthInvitees: 0 };
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="邀请返利" description="邀请好友注册并消费,你将获得他消费金额的 5% 作为返利。" />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="累计邀请" value={stats.invitees} icon={Users2} />
        <StatCard title="累计返利" value={formatCurrency(Number(stats.totalReward))} icon={Coins} tone="success" />
        <StatCard title="本月新增" value={stats.monthInvitees} icon={TrendingUp} tone="warning" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>你的邀请链接</CardTitle>
          <CardDescription>分享给好友,你和他都将获得额外奖励。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={url} className="font-mono text-xs" />
            <Button variant="outline" onClick={() => { if (url) { copyToClipboard(url); toast.success("已复制邀请链接"); } }}>
              <Copy />复制
            </Button>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground">邀请码:</span>
            <code className="text-sm font-mono px-2 py-0.5 rounded bg-muted">{code || "—"}</code>
            {code && (
              <Button variant="ghost" size="icon" onClick={() => { copyToClipboard(code); toast.success("已复制邀请码"); }}>
                <Copy />
              </Button>
            )}
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
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <Users2 className="mx-auto size-8 mb-2 opacity-50" />
                    还没有邀请记录,把链接分享给好友吧。
                  </div>
                </TableCell>
              </TableRow>
            )}
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{maskEmail(r.email)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(r.joinedAt).toLocaleDateString("zh-CN")}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(Number(r.totalSpend))}</TableCell>
                <TableCell className="text-right tabular-nums text-success">{formatCurrency(Number(r.reward))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
