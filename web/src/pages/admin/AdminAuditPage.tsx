import { useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { fetcher, type AuditLog, type Page } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

const PAGE_SIZE = 30;

const ACTION_OPTIONS = [
  { value: "all", label: "全部事件" },
  { value: "topup.redeem", label: "卡密兑换" },
  { value: "referral.reward", label: "邀请返利" },
];

function actionLabel(a: string): string {
  return ACTION_OPTIONS.find((o) => o.value === a)?.label ?? a;
}

export default function AdminAuditPage() {
  const [action, setAction] = useState("all");
  const [actor, setActor] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));
  if (action !== "all") params.set("action", action);
  if (actor) params.set("actorId", actor);

  const { data } = useSWR<Page<AuditLog>>(`/admin/audit?${params}`, fetcher, {
    revalidateOnFocus: false,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="审计日志"
        description="记录卡密兑换、邀请返利、管理后台变更等关键事件，便于事后追溯。"
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
            <SelectTrigger className="md:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="操作者 ID（可选）"
            value={actor}
            onChange={(e) => { setActor(e.target.value.replace(/\D/g, "")); setPage(1); }}
            className="md:w-52"
          />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>事件</TableHead>
              <TableHead>操作者</TableHead>
              <TableHead>目标</TableHead>
              <TableHead className="text-right">金额</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>明细</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="py-10 text-center text-sm text-muted-foreground">暂无审计记录</div>
                </TableCell>
              </TableRow>
            )}
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(row.createdAt).toLocaleString("zh-CN", { hour12: false })}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono text-[10px]">{actionLabel(row.action)}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {row.actorEmail ?? (row.actorId ? `#${row.actorId}` : "—")}
                </TableCell>
                <TableCell className="text-sm">
                  {row.targetEmail ?? (row.targetUserId ? `#${row.targetUserId}` : row.target || "—")}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {row.amount > 0 ? formatCurrency(Number(row.amount)) : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.ip || "—"}</TableCell>
                <TableCell className="text-xs font-mono max-w-xs truncate" title={row.detail}>
                  {row.detail && row.detail !== "{}" ? row.detail : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between p-4 text-sm text-muted-foreground border-t">
          <span>共 {total} 条</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
            <span className="tabular-nums">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
          </div>
        </div>
      </Card>
    </>
  );
}
