import { useState } from "react";
import { Search, Shield, Ban, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { demoAdminUsers, type AdminUser } from "@/lib/mockAdmin";
import { formatCurrency, timeAgo } from "@/lib/utils";

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>(demoAdminUsers);
  const [query, setQuery] = useState("");

  const filtered = users.filter((u) => `${u.email} ${u.group}`.toLowerCase().includes(query.toLowerCase()));

  function toggleStatus(id: number) {
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, status: u.status === "active" ? "banned" : "active" } : u)));
    toast.success("已更新");
  }

  return (
    <>
      <PageHeader title="用户管理" description="查看、调整用户余额、分组与状态。" />

      <Card className="p-4 mb-4">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索邮箱 / 分组" className="pl-9" />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>分组</TableHead>
              <TableHead className="text-right">余额</TableHead>
              <TableHead className="text-right">累计消费</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="text-muted-foreground">#{u.id}</TableCell>
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell>
                  {u.role === "admin" ? (
                    <Badge><Shield className="size-3" />管理员</Badge>
                  ) : (
                    <Badge variant="secondary">用户</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{u.group}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(u.balance)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(u.used)}</TableCell>
                <TableCell>
                  {u.status === "active" ? <Badge variant="success">正常</Badge> : <Badge variant="danger">已封禁</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{timeAgo(u.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => toggleStatus(u.id)} title={u.status === "active" ? "封禁" : "解封"}>
                    {u.status === "active" ? <Ban /> : <CircleCheck />}
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
