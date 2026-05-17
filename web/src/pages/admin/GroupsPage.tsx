import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2, Edit3, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { apiFetch, fetcher, type AdminGroup } from "@/lib/api";
import { timeAgo } from "@/lib/utils";

export default function GroupsPage() {
  const { data, mutate } = useSWR<AdminGroup[]>("/admin/groups", fetcher, {
    revalidateOnFocus: false,
  });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminGroup | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const groups = data ?? [];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>, isEdit: boolean) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    const body = {
      name: String(fd.get("name")),
      ratio: String(fd.get("ratio") || "1"),
      note: String(fd.get("note") || ""),
    };
    try {
      if (isEdit && editing) {
        await apiFetch(`/admin/groups/${editing.id}`, { method: "PUT", body: JSON.stringify(body) });
        toast.success("已保存");
        setEditing(null);
      } else {
        await apiFetch("/admin/groups", { method: "POST", body: JSON.stringify(body) });
        toast.success("分组已创建");
        setCreating(false);
      }
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(g: AdminGroup) {
    if (g.id === 1) {
      toast.error("默认分组不可删除");
      return;
    }
    if (!confirm(`确认删除分组「${g.name}」?`)) return;
    try {
      await apiFetch(`/admin/groups/${g.id}`, { method: "DELETE" });
      toast.success("已删除");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  }

  return (
    <>
      <PageHeader
        title="分组管理"
        description="为不同用户群体设置独立的价格倍率。"
        actions={
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button><Plus />新建分组</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新建分组</DialogTitle>
                <DialogDescription>分组用于区分不同用户的价格倍率。</DialogDescription>
              </DialogHeader>
              <GroupForm submitting={submitting} onCancel={() => setCreating(false)} onSubmit={(e) => onSubmit(e, false)} />
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>分组</TableHead>
              <TableHead className="text-right">倍率</TableHead>
              <TableHead>备注</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <Tag className="mx-auto size-8 mb-2 opacity-50" />
                    暂无分组
                  </div>
                </TableCell>
              </TableRow>
            )}
            {groups.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="text-muted-foreground">#{g.id}</TableCell>
                <TableCell><Badge variant="outline">{g.name}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{Number(g.ratio).toFixed(2)}×</TableCell>
                <TableCell className="text-sm text-muted-foreground">{g.note || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{timeAgo(g.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(g)}><Edit3 /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(g)} disabled={g.id === 1}>
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑分组 {editing?.name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <GroupForm
              submitting={submitting}
              onCancel={() => setEditing(null)}
              onSubmit={(e) => onSubmit(e, true)}
              initial={editing}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function GroupForm({
  submitting,
  onCancel,
  onSubmit,
  initial,
}: {
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  initial?: AdminGroup;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">名称</Label>
        <Input id="name" name="name" required defaultValue={initial?.name} placeholder="比如:vip" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ratio">倍率</Label>
        <Input id="ratio" name="ratio" defaultValue={initial?.ratio ?? "1"} placeholder="1.0" />
        <p className="text-xs text-muted-foreground">最终价格 = 模型倍率 × 分组倍率</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">备注</Label>
        <Input id="note" name="note" defaultValue={initial?.note} placeholder="可选" />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          保存
        </Button>
      </DialogFooter>
    </form>
  );
}
