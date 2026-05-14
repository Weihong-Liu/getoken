import { useState } from "react";
import useSWR from "swr";
import { Plus, Power, PowerOff, Trash2, Server, Edit3, Loader2 } from "lucide-react";
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
  DialogFooter,
  DialogTrigger,
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
import { apiFetch, fetcher, type AdminUpstream } from "@/lib/api";
import { timeAgo } from "@/lib/utils";

const statusMap = {
  online: { label: "在线", variant: "success" as const },
  degraded: { label: "缓慢", variant: "warning" as const },
  offline: { label: "离线", variant: "danger" as const },
};

const UPSTREAM_TYPES = ["openai", "anthropic", "gemini", "oneapi", "newapi", "sub2api"];

export default function ChannelsPage() {
  const { data, mutate } = useSWR<AdminUpstream[]>("/admin/upstreams", fetcher, {
    revalidateOnFocus: false,
  });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUpstream | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const upstreams = data ?? [];

  async function toggleStatus(u: AdminUpstream) {
    try {
      await apiFetch(`/admin/upstreams/${u.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: u.name,
          baseUrl: u.baseUrl,
          status: u.status === "offline" ? "online" : "offline",
        }),
      });
      toast.success("已更新");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function onDelete(u: AdminUpstream) {
    if (!confirm(`确认删除「${u.name}」?`)) return;
    try {
      await apiFetch(`/admin/upstreams/${u.id}`, { method: "DELETE" });
      toast.success("已删除");
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
      await apiFetch("/admin/upstreams", {
        method: "POST",
        body: JSON.stringify({
          name: String(fd.get("name")),
          type: String(fd.get("type") || "openai"),
          baseUrl: String(fd.get("baseUrl")),
          apiKey: String(fd.get("apiKey")),
          status: String(fd.get("status") || "online"),
          priority: Number(fd.get("priority") || 5),
          weight: Number(fd.get("weight") || 5),
          note: String(fd.get("note") || ""),
        }),
      });
      toast.success("上游网关已创建");
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
      name: String(fd.get("name")),
      type: String(fd.get("type") || editing.type),
      baseUrl: String(fd.get("baseUrl")),
      status: String(fd.get("status") || editing.status),
      priority: Number(fd.get("priority") || editing.priority),
      weight: Number(fd.get("weight") || editing.weight),
      note: String(fd.get("note") || ""),
    };
    const apiKey = String(fd.get("apiKey") || "");
    if (apiKey) body.apiKey = apiKey;
    try {
      await apiFetch(`/admin/upstreams/${editing.id}`, {
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
        title="上游网关"
        description="管理上游 API 网关 (Upstream),配置接入类型、密钥与调度策略。"
        actions={
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button><Plus />新增上游</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增上游网关</DialogTitle>
                <DialogDescription>每个上游对应一个 API 接入点 (如 OpenAI / Anthropic / 自建 OneAPI 等)。</DialogDescription>
              </DialogHeader>
              <UpstreamForm
                submitting={submitting}
                onCancel={() => setCreating(false)}
                onSubmit={onCreate}
                requireKey
              />
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>Base URL</TableHead>
              <TableHead>密钥</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>优先级 / 权重</TableHead>
              <TableHead className="text-right">延迟</TableHead>
              <TableHead>最近检测</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {upstreams.length === 0 && (
              <TableRow>
                <TableCell colSpan={9}>
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <Server className="mx-auto size-8 mb-2 opacity-50" />
                    还没有上游网关,点击右上角添加。
                  </div>
                </TableCell>
              </TableRow>
            )}
            {upstreams.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell><Badge variant="secondary" className="font-mono text-xs">{u.type}</Badge></TableCell>
                <TableCell><code className="text-xs font-mono text-muted-foreground">{u.baseUrl}</code></TableCell>
                <TableCell><code className="text-xs font-mono text-muted-foreground">{u.apiKeyMask || "—"}</code></TableCell>
                <TableCell><Badge variant={statusMap[u.status].variant}>{statusMap[u.status].label}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">{u.priority} / {u.weight}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{u.latencyMs > 0 ? `${u.latencyMs}ms` : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.lastCheckAt ? timeAgo(u.lastCheckAt) : "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(u)} title="编辑"><Edit3 /></Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleStatus(u)} title={u.status === "offline" ? "启用" : "禁用"}>
                    {u.status === "offline" ? <Power /> : <PowerOff />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(u)} title="删除">
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
            <DialogTitle>编辑上游 {editing?.name}</DialogTitle>
            <DialogDescription>API Key 留空表示不修改。</DialogDescription>
          </DialogHeader>
          {editing && (
            <UpstreamForm
              submitting={submitting}
              onCancel={() => setEditing(null)}
              onSubmit={onEdit}
              initial={editing}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function UpstreamForm({
  submitting,
  onCancel,
  onSubmit,
  initial,
  requireKey,
}: {
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  initial?: AdminUpstream;
  requireKey?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="name">名称</Label>
          <Input id="name" name="name" required defaultValue={initial?.name} placeholder="比如:OpenAI 官方" />
        </div>
        <div className="space-y-2">
          <Label>类型</Label>
          <Select name="type" defaultValue={initial?.type ?? "openai"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {UPSTREAM_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="baseUrl">Base URL</Label>
        <Input id="baseUrl" name="baseUrl" required defaultValue={initial?.baseUrl} placeholder="https://api.openai.com/v1" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="apiKey">API Key {requireKey ? "" : "(留空不修改)"}</Label>
        <Input id="apiKey" name="apiKey" type="password" required={requireKey} placeholder={initial?.apiKeyMask ?? "sk-..."} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>状态</Label>
          <Select name="status" defaultValue={initial?.status ?? "online"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="online">在线</SelectItem>
              <SelectItem value="degraded">缓慢</SelectItem>
              <SelectItem value="offline">离线</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">优先级</Label>
          <Input id="priority" name="priority" type="number" defaultValue={initial?.priority ?? 5} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weight">权重</Label>
          <Input id="weight" name="weight" type="number" defaultValue={initial?.weight ?? 5} />
        </div>
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
