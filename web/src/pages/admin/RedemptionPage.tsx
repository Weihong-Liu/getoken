import { useState } from "react";
import useSWR from "swr";
import { Plus, Copy, Download, Trash2, Loader2, Gift, Search } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  apiFetch,
  fetcher,
  type AdminRedemption,
  type AdminRedemptionBatch,
  type Page,
} from "@/lib/api";
import { demoAdminRedemptions } from "@/lib/mock";
import { copyToClipboard, formatCurrency, timeAgo } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function RedemptionPage() {
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [generatedBatch, setGeneratedBatch] = useState<AdminRedemptionBatch | null>(null);

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (batchFilter) params.set("batch", batchFilter);

  const { data, mutate } = useSWR<Page<AdminRedemption>>(`/admin/redemption?${params}`, fetcher, {
    fallbackData: { items: demoAdminRedemptions, total: demoAdminRedemptions.length, page, pageSize: PAGE_SIZE },
    revalidateOnFocus: false,
  });

  const codes = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const result = await apiFetch<AdminRedemptionBatch>("/admin/redemption", {
        method: "POST",
        body: JSON.stringify({
          count: Number(fd.get("count") || 1),
          amount: String(fd.get("amount") || "0"),
        }),
      });
      toast.success(`已生成 ${result.count} 张卡密`);
      setCreating(false);
      setGeneratedBatch(result);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(c: AdminRedemption) {
    if (!confirm(`确认删除卡密「${c.code}」?`)) return;
    try {
      await apiFetch(`/admin/redemption/${c.id}`, { method: "DELETE" });
      toast.success("已删除");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  }

  function exportCsv() {
    const exportParams = new URLSearchParams();
    if (statusFilter !== "all") exportParams.set("status", statusFilter);
    if (batchFilter) exportParams.set("batch", batchFilter);
    window.open(`/api/admin/redemption/export?${exportParams}`, "_blank");
  }

  return (
    <>
      <PageHeader
        title="卡密管理"
        description="批量生成兑换码,可分发给用户进行充值。"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><Download />导出</Button>
            <Dialog open={creating} onOpenChange={setCreating}>
              <DialogTrigger asChild>
                <Button><Plus />生成卡密</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>批量生成卡密</DialogTitle>
                  <DialogDescription>每张卡密金额相同,可一次性生成多张。</DialogDescription>
                </DialogHeader>
                <form onSubmit={onCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="amount">每张面额 ($)</Label>
                      <Input id="amount" name="amount" type="number" step="0.01" min={1} defaultValue={50} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="count">生成数量</Label>
                      <Input id="count" name="count" type="number" min={1} max={1000} defaultValue={10} required />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreating(false)}>取消</Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="size-4 animate-spin" />}
                      生成
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="按批次 ID 过滤" value={batchFilter} onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }} className="pl-9 font-mono text-xs" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="md:w-40"><SelectValue placeholder="所有状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有状态</SelectItem>
              <SelectItem value="unused">未使用</SelectItem>
              <SelectItem value="used">已使用</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>卡密</TableHead>
              <TableHead className="text-right">面额</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>批次</TableHead>
              <TableHead>使用者</TableHead>
              <TableHead>使用时间</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <Gift className="mx-auto size-8 mb-2 opacity-50" />
                    还没有卡密
                  </div>
                </TableCell>
              </TableRow>
            )}
            {codes.map((c) => (
              <TableRow key={c.id}>
                <TableCell><code className="text-xs font-mono">{c.code}</code></TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(Number(c.amount))}</TableCell>
                <TableCell>
                  {c.status === "unused" ? <Badge variant="success">未使用</Badge> : <Badge variant="secondary">已使用</Badge>}
                </TableCell>
                <TableCell><code className="text-xs font-mono text-muted-foreground">{c.batchId || "—"}</code></TableCell>
                <TableCell className="text-sm">{c.usedBy ? `#${c.usedBy}` : "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.usedAt ? timeAgo(c.usedAt) : "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{timeAgo(c.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { copyToClipboard(c.code); toast.success("已复制"); }}>
                    <Copy />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(c)} disabled={c.status === "used"}>
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between p-4 text-sm text-muted-foreground border-t">
          <span>共 {total} 条记录</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
            <span className="tabular-nums">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
          </div>
        </div>
      </Card>

      <Dialog open={!!generatedBatch} onOpenChange={(v) => { if (!v) setGeneratedBatch(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成成功</DialogTitle>
            <DialogDescription>
              批次 <code className="text-xs font-mono">{generatedBatch?.batchId}</code> 共 {generatedBatch?.count} 张卡密。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-auto rounded-md bg-muted/40 p-3 space-y-1">
            {generatedBatch?.codes.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs">
                <code className="font-mono">{c.code}</code>
                <span className="text-muted-foreground tabular-nums">{formatCurrency(Number(c.amount))}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!generatedBatch) return;
                const text = generatedBatch.codes.map((c) => c.code).join("\n");
                copyToClipboard(text);
                toast.success("已复制所有卡密");
              }}
            >
              <Copy /> 复制全部
            </Button>
            <Button onClick={() => setGeneratedBatch(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
