import { useState } from "react";
import useSWR from "swr";
import { Search, Shield, Ban, CircleCheck, Plus, Edit3, Loader2, Users2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { apiFetch, fetcher, type AdminUser, type Page } from "@/lib/api";
import { demoAdminUsers } from "@/lib/mock";
import { formatCurrency, timeAgo } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function UsersPage() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (role !== "all") params.set("role", role);
  if (status !== "all") params.set("status", status);
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));

  const { data, mutate } = useSWR<Page<AdminUser>>(`/admin/users?${params}`, fetcher, {
    fallbackData: { items: demoAdminUsers, total: demoAdminUsers.length, page, pageSize: PAGE_SIZE },
    revalidateOnFocus: false,
  });

  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function toggleStatus(u: AdminUser) {
    try {
      await apiFetch(`/admin/users/${u.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: u.status === "active" ? "banned" : "active" }),
      });
      toast.success(u.status === "active" ? "已封禁" : "已解封");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await apiFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: String(fd.get("email")),
          password: String(fd.get("password")),
          username: String(fd.get("username") || ""),
          role: String(fd.get("role") || "user"),
          groupId: Number(fd.get("groupId") || 1),
        }),
      });
      toast.success("用户已创建");
      setCreating(false);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function onEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    const body: Record<string, unknown> = {
      username: String(fd.get("username") || ""),
      role: String(fd.get("role") || editing.role),
      status: String(fd.get("status") || editing.status),
      groupId: Number(fd.get("groupId") || editing.groupId),
      quota: String(fd.get("quota") ?? editing.quota),
    };
    const password = String(fd.get("password") || "");
    if (password) body.password = password;
    try {
      await apiFetch(`/admin/users/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      toast.success("已保存");
      setEditing(null);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="用户管理"
        description="查看、调整用户余额、分组与状态。"
        actions={
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button><Plus />新建用户</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新建用户</DialogTitle>
                <DialogDescription>手动创建账户,可指定角色与分组。</DialogDescription>
              </DialogHeader>
              <form onSubmit={onCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">用户名 (可选)</Label>
                  <Input id="username" name="username" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input id="password" name="password" type="password" required minLength={6} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>角色</Label>
                    <Select name="role" defaultValue="user">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">用户</SelectItem>
                        <SelectItem value="admin">管理员</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="groupId">分组 ID</Label>
                    <Input id="groupId" name="groupId" type="number" defaultValue={1} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreating(false)}>取消</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="size-4 animate-spin" />}
                    创建
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="搜索邮箱 / 用户名" className="pl-9" />
          </div>
          <Select value={role} onValueChange={(v) => { setRole(v); setPage(1); }}>
            <SelectTrigger className="md:w-40"><SelectValue placeholder="所有角色" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有角色</SelectItem>
              <SelectItem value="user">用户</SelectItem>
              <SelectItem value="admin">管理员</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="md:w-40"><SelectValue placeholder="所有状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有状态</SelectItem>
              <SelectItem value="active">正常</SelectItem>
              <SelectItem value="banned">已封禁</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>用户名</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>分组</TableHead>
              <TableHead className="text-right">余额</TableHead>
              <TableHead className="text-right">已用</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={10}>
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <Users2 className="mx-auto size-8 mb-2 opacity-50" />
                    没有符合条件的用户
                  </div>
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="text-muted-foreground">#{u.id}</TableCell>
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell className="text-sm">{u.username || "—"}</TableCell>
                <TableCell>
                  {u.role === "admin" ? (
                    <Badge><Shield className="size-3" />管理员</Badge>
                  ) : (
                    <Badge variant="secondary">用户</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">#{u.groupId}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(Number(u.quota))}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(Number(u.usedQuota))}</TableCell>
                <TableCell>
                  {u.status === "active" ? <Badge variant="success">正常</Badge> : <Badge variant="danger">已封禁</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{timeAgo(u.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(u)} title="编辑">
                    <Edit3 />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleStatus(u)} title={u.status === "active" ? "封禁" : "解封"}>
                    {u.status === "active" ? <Ban /> : <CircleCheck />}
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

      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户 {editing?.email}</DialogTitle>
            <DialogDescription>修改用户信息、配额与状态。</DialogDescription>
          </DialogHeader>
          {editing && (
            <form onSubmit={onEdit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="e-username">用户名</Label>
                <Input id="e-username" name="username" defaultValue={editing.username} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>角色</Label>
                  <Select name="role" defaultValue={editing.role}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">用户</SelectItem>
                      <SelectItem value="admin">管理员</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>状态</Label>
                  <Select name="status" defaultValue={editing.status}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">正常</SelectItem>
                      <SelectItem value="banned">已封禁</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="e-groupId">分组 ID</Label>
                  <Input id="e-groupId" name="groupId" type="number" defaultValue={editing.groupId} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-quota">额度 ($)</Label>
                  <Input id="e-quota" name="quota" type="number" step="0.01" defaultValue={editing.quota} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-password">重置密码 (留空表示不修改)</Label>
                <Input id="e-password" name="password" type="password" minLength={6} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>取消</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  保存
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
