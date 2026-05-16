import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2, Edit3, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { apiFetch, fetcher, type AdminAnnouncement } from "@/lib/api";
import { demoAdminAnnouncements } from "@/lib/mock";
import { timeAgo } from "@/lib/utils";

const levelMap = {
  info: { label: "通知", variant: "default" as const },
  warning: { label: "重要", variant: "warning" as const },
  danger: { label: "紧急", variant: "danger" as const },
};

export default function AnnouncementsPage() {
  const { data, mutate } = useSWR<AdminAnnouncement[]>("/admin/announcements", fetcher, {
    fallbackData: demoAdminAnnouncements,
    revalidateOnFocus: false,
  });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminAnnouncement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const items = data ?? [];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>, isEdit: boolean) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    const body = {
      title: String(fd.get("title")),
      content: String(fd.get("content") || ""),
      level: String(fd.get("level") || "info"),
      status: String(fd.get("status") || "published"),
    };
    try {
      if (isEdit && editing) {
        await apiFetch(`/admin/announcements/${editing.id}`, { method: "PUT", body: JSON.stringify(body) });
        toast.success("已保存");
        setEditing(null);
      } else {
        await apiFetch("/admin/announcements", { method: "POST", body: JSON.stringify(body) });
        toast.success("公告已发布");
        setCreating(false);
      }
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(a: AdminAnnouncement) {
    if (!confirm(`删除公告「${a.title}」?`)) return;
    try {
      await apiFetch(`/admin/announcements/${a.id}`, { method: "DELETE" });
      toast.success("已删除");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  }

  return (
    <>
      <PageHeader
        title="公告管理"
        description="发布站点公告,会展示在用户控制台首页。"
        actions={
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button><Plus />新建公告</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新建公告</DialogTitle>
                <DialogDescription>支持设置级别与发布状态。</DialogDescription>
              </DialogHeader>
              <AnnouncementForm submitting={submitting} onCancel={() => setCreating(false)} onSubmit={(e) => onSubmit(e, false)} />
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>级别</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <Megaphone className="mx-auto size-8 mb-2 opacity-50" />
                    还没有公告
                  </div>
                </TableCell>
              </TableRow>
            )}
            {items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell><Badge variant={levelMap[a.level].variant}>{levelMap[a.level].label}</Badge></TableCell>
                <TableCell>
                  {a.status === "published" ? <Badge variant="success">已发布</Badge> : <Badge variant="secondary">草稿</Badge>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{timeAgo(a.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(a)}><Edit3 /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(a)}><Trash2 /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑公告</DialogTitle>
          </DialogHeader>
          {editing && (
            <AnnouncementForm
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

function AnnouncementForm({
  submitting,
  onCancel,
  onSubmit,
  initial,
}: {
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  initial?: AdminAnnouncement;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">标题</Label>
        <Input id="title" name="title" required defaultValue={initial?.title} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="content">内容</Label>
        <textarea
          id="content"
          name="content"
          rows={4}
          defaultValue={initial?.content}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>级别</Label>
          <Select name="level" defaultValue={initial?.level ?? "info"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">通知</SelectItem>
              <SelectItem value="warning">重要</SelectItem>
              <SelectItem value="danger">紧急</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>状态</Label>
          <Select name="status" defaultValue={initial?.status ?? "published"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="published">发布</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
