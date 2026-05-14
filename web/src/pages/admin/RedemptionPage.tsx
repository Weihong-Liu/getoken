import { useState } from "react";
import { Plus, Copy, Download } from "lucide-react";
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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { demoRedemptionCodes, type RedemptionCode } from "@/lib/mockAdmin";
import { copyToClipboard, formatCurrency, timeAgo } from "@/lib/utils";

function randomCode() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GT-${part()}-${part()}-${part()}`;
}

export default function RedemptionPage() {
  const [codes, setCodes] = useState<RedemptionCode[]>(demoRedemptionCodes);
  const [open, setOpen] = useState(false);

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    const count = Number(fd.get("count") ?? 1);
    const next: RedemptionCode[] = Array.from({ length: count }, (_, i) => ({
      id: Math.max(0, ...codes.map((c) => c.id)) + i + 1,
      code: randomCode(),
      amount,
      status: "unused",
      createdAt: new Date().toISOString(),
    }));
    setCodes((list) => [...next, ...list]);
    setOpen(false);
    toast.success(`已生成 ${count} 张卡密`);
  }

  function exportCsv() {
    const headers = ["code", "amount", "status", "usedBy", "usedAt", "createdAt"];
    const rows = codes.map((c) => [c.code, c.amount, c.status, c.usedBy ?? "", c.usedAt ?? "", c.createdAt]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `getoken-codes-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="卡密管理"
        description="批量生成兑换码,可分发给用户进行充值。"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><Download />导出</Button>
            <Dialog open={open} onOpenChange={setOpen}>
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
                      <Label htmlFor="amount">每张面额 (¥)</Label>
                      <Input id="amount" name="amount" type="number" min={1} defaultValue={50} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="count">生成数量</Label>
                      <Input id="count" name="count" type="number" min={1} max={1000} defaultValue={10} required />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
                    <Button type="submit">生成</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>卡密</TableHead>
              <TableHead className="text-right">面额</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>使用者</TableHead>
              <TableHead>使用时间</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.map((c) => (
              <TableRow key={c.id}>
                <TableCell><code className="text-xs font-mono">{c.code}</code></TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(c.amount)}</TableCell>
                <TableCell>
                  {c.status === "unused" ? <Badge variant="success">未使用</Badge> : <Badge variant="secondary">已使用</Badge>}
                </TableCell>
                <TableCell className="text-sm">{c.usedBy ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.usedAt ? timeAgo(c.usedAt) : "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{timeAgo(c.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { copyToClipboard(c.code); toast.success("已复制"); }}>
                    <Copy />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
