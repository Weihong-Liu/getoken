import { useState } from "react";
import { Plus, Trash2, Edit3 } from "lucide-react";
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
import { demoAnnouncements, type Announcement } from "@/lib/mockAdmin";
import { timeAgo } from "@/lib/utils";

const levelMap = {
  info: { label: "通知", variant: "default" as const },
  warning: { label: "重要", variant: "warning" as const },
  danger: { label: "紧急", variant: "danger" as const },
};

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>(demoAnnouncements);
  const [open, setOpen] = useState(false);

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setItems((list) => [
      {
        id: Math.max(0, ...list.map((i) => i.id)) + 1,
        title: String(fd.get("title")),
        level: fd.get("level") as Announcement["level"],
        status: "published",
        createdAt: new Date().toISOString(),
      },
      ...list,
    ]);
    setOpen(false);
    toast.success("公告已发布");
  }

  function onDelete(id: number) {
    if (!confirm("删除该公告?")) return;
    setItems((list) => list.filter((i) => i.id !== id));
  }

  return (
    <>
      <PageHeader
        title="公告管理"
        description="发布站点公告,会展示在用户控制台首页。"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus />新建公告</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>新建公告</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">标题</Label>
                  <Input id="title" name="title" required />
                </div>
                <div className="space-y-2">
                  <Label>级别</Label>
                  <Select name="level" defaultValue="info">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">通知</SelectItem>
                      <SelectItem value="warning">重要</SelectItem>
                      <SelectItem value="danger">紧急</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
                  <Button type="submit">发布</Button>
                </DialogFooter>
              </form>
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
            {items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell><Badge variant={levelMap[a.level].variant}>{levelMap[a.level].label}</Badge></TableCell>
                <TableCell>
                  {a.status === "published" ? <Badge variant="success">已发布</Badge> : <Badge variant="secondary">草稿</Badge>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{timeAgo(a.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon"><Edit3 /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(a.id)}><Trash2 /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
