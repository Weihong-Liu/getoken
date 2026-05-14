import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { demoAdminGroups, type AdminGroup } from "@/lib/mockAdmin";

export default function GroupsPage() {
  const [groups, setGroups] = useState<AdminGroup[]>(demoAdminGroups);
  const [open, setOpen] = useState(false);

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setGroups((list) => [
      ...list,
      {
        id: Math.max(0, ...list.map((g) => g.id)) + 1,
        name: String(fd.get("name")),
        ratio: Number(fd.get("ratio") ?? 1),
        users: 0,
        channels: 0,
      },
    ]);
    setOpen(false);
    toast.success("分组已创建");
  }

  function onDelete(id: number) {
    if (!confirm("确认删除该分组?")) return;
    setGroups((list) => list.filter((g) => g.id !== id));
  }

  return (
    <>
      <PageHeader
        title="分组管理"
        description="为不同用户群体设置独立的倍率与可用渠道。"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus />新建分组</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新建分组</DialogTitle>
                <DialogDescription>分组用于隔离不同用户的可用渠道和倍率。</DialogDescription>
              </DialogHeader>
              <form onSubmit={onCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">名称</Label>
                  <Input id="name" name="name" required placeholder="比如:vip" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ratio">倍率</Label>
                  <Input id="ratio" name="ratio" type="number" step={0.1} defaultValue={1} />
                  <p className="text-xs text-muted-foreground">最终价格 = 模型倍率 × 分组倍率</p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
                  <Button type="submit">创建</Button>
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
              <TableHead>分组</TableHead>
              <TableHead className="text-right">倍率</TableHead>
              <TableHead className="text-right">用户数</TableHead>
              <TableHead className="text-right">可用渠道</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <TableRow key={g.id}>
                <TableCell>
                  <Badge variant="outline">{g.name}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{g.ratio.toFixed(2)}×</TableCell>
                <TableCell className="text-right tabular-nums">{g.users}</TableCell>
                <TableCell className="text-right tabular-nums">{g.channels}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => onDelete(g.id)} disabled={g.name === "default"}>
                    <Trash2 />
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
