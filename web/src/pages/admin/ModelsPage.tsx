import { useState } from "react";
import useSWR from "swr";
import { Plus, Edit3, Trash2, Loader2, Cpu, Download } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { apiFetch, fetcher, type AdminModelMapping, type AdminUpstream } from "@/lib/api";

export default function ModelsPage() {
  const { data, mutate } = useSWR<AdminModelMapping[]>("/admin/models", fetcher, {
    revalidateOnFocus: false,
  });
  const { data: upstreams } = useSWR<AdminUpstream[]>("/admin/upstreams", fetcher, {
    revalidateOnFocus: false,
  });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminModelMapping | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedUpstreamId, setSeedUpstreamId] = useState<string>("");
  const [seedOverwrite, setSeedOverwrite] = useState(false);

  const models = data ?? [];
  const upstreamList = upstreams ?? [];

  async function toggleStatus(m: AdminModelMapping) {
    try {
      await apiFetch(`/admin/models/${m.id}`, {
        method: "PUT",
        body: JSON.stringify({
          modelId: m.modelId,
          vendor: m.vendor,
          upstreamId: m.upstreamId,
          upstreamModelName: m.upstreamModelName,
          inputPrice: String(m.inputPrice),
          outputPrice: String(m.outputPrice),
          cachedPrice: String(m.cachedPrice ?? 0),
          cacheCreationPrice: String(m.cacheCreationPrice ?? 0),
          context: m.context,
          status: m.status === "online" ? "offline" : "online",
          allowedGroups: m.allowedGroups,
        }),
      });
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function onDelete(m: AdminModelMapping) {
    if (!confirm(`确认删除模型映射「${m.modelId}」?`)) return;
    try {
      await apiFetch(`/admin/models/${m.id}`, { method: "DELETE" });
      toast.success("已删除");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>, isEdit: boolean) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    const body = {
      modelId: String(fd.get("modelId")),
      vendor: String(fd.get("vendor")),
      upstreamId: Number(fd.get("upstreamId")),
      upstreamModelName: String(fd.get("upstreamModelName")),
      inputPrice: String(fd.get("inputPrice") || "1"),
      outputPrice: String(fd.get("outputPrice") || "1"),
      cachedPrice: String(fd.get("cachedPrice") || "0"),
      cacheCreationPrice: String(fd.get("cacheCreationPrice") || "0"),
      context: Number(fd.get("context") || 0),
      status: String(fd.get("status") || "online"),
      allowedGroups: String(fd.get("allowedGroups") || "default"),
    };
    try {
      if (isEdit && editing) {
        await apiFetch(`/admin/models/${editing.id}`, { method: "PUT", body: JSON.stringify(body) });
        toast.success("已保存");
        setEditing(null);
      } else {
        await apiFetch("/admin/models", { method: "POST", body: JSON.stringify(body) });
        toast.success("已创建");
        setCreating(false);
      }
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSeed() {
    setSeeding(true);
    try {
      const res = await apiFetch<{ created: number; updated: number; skipped: number }>(
        "/admin/models/seed-defaults",
        {
          method: "POST",
          body: JSON.stringify({
            upstreamId: seedUpstreamId ? Number(seedUpstreamId) : 0,
            overwrite: seedOverwrite,
          }),
        },
      );
      toast.success(`导入完成：新增 ${res.created} / 更新 ${res.updated} / 跳过 ${res.skipped}`);
      setSeedOpen(false);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <>
      <PageHeader
        title="模型管理"
        description="将公开模型映射到上游网关,设置价格倍率与可用分组。"
        actions={
          <div className="flex gap-2">
            <Dialog open={seedOpen} onOpenChange={setSeedOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!seedUpstreamId && upstreamList[0]) {
                      setSeedUpstreamId(String(upstreamList[0].id));
                    }
                  }}
                >
                  <Download />导入内置模型
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>导入内置模型</DialogTitle>
                  <DialogDescription>
                    一键批量灌入核心模型快照（Claude / GPT / Gemini）。
                    新增条目会使用所选上游；已存在的模型可选择是否覆盖价格。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>目标上游</Label>
                    <Select value={seedUpstreamId} onValueChange={setSeedUpstreamId}>
                      <SelectTrigger><SelectValue placeholder="选择上游" /></SelectTrigger>
                      <SelectContent>
                        {upstreamList.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {upstreamList.length === 0 && (
                      <p className="text-xs text-muted-foreground">还没有上游，请先到「上游」页面创建。</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <Label htmlFor="seed-overwrite" className="cursor-pointer">覆盖已存在模型</Label>
                      <p className="text-xs text-muted-foreground">仅刷价格 / 上下文 / 厂商，不动 upstream 和分组</p>
                    </div>
                    <Switch
                      id="seed-overwrite"
                      checked={seedOverwrite}
                      onCheckedChange={setSeedOverwrite}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSeedOpen(false)}>取消</Button>
                  <Button onClick={onSeed} disabled={seeding || upstreamList.length === 0}>
                    {seeding && <Loader2 className="size-4 animate-spin" />}
                    确认导入
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={creating} onOpenChange={setCreating}>
              <DialogTrigger asChild>
                <Button><Plus />新建映射</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新建模型映射</DialogTitle>
                  <DialogDescription>把对外的模型 ID 映射到上游真实模型。</DialogDescription>
                </DialogHeader>
                <ModelForm
                  upstreams={upstreamList}
                  submitting={submitting}
                  onCancel={() => setCreating(false)}
                  onSubmit={(e) => onSubmit(e, false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>对外模型 ID</TableHead>
              <TableHead>厂商</TableHead>
              <TableHead>上游</TableHead>
              <TableHead>上游模型</TableHead>
              <TableHead className="w-24 text-right" title="USD per 1M input tokens">输入 $/M</TableHead>
              <TableHead className="w-24 text-right" title="USD per 1M output tokens">输出 $/M</TableHead>
              <TableHead className="w-20 text-right text-xs" title="USD per 1M cache-hit tokens">缓存 $/M</TableHead>
              <TableHead className="w-20 text-right text-xs" title="USD per 1M cache-write tokens">写缓存 $/M</TableHead>
              <TableHead className="text-right">上下文</TableHead>
              <TableHead>开放分组</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.length === 0 && (
              <TableRow>
                <TableCell colSpan={12}>
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <Cpu className="mx-auto size-8 mb-2 opacity-50" />
                    还没有模型映射,先添加上游再创建映射。
                  </div>
                </TableCell>
              </TableRow>
            )}
            {models.map((m) => {
              const upstream = upstreamList.find((u) => u.id === m.upstreamId);
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.modelId}</TableCell>
                  <TableCell>{m.vendor}</TableCell>
                  <TableCell className="text-sm">{upstream?.name ?? `#${m.upstreamId}`}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{m.upstreamModelName}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(m.inputPrice).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(m.outputPrice).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {Number(m.cachedPrice ?? 0) > 0 ? Number(m.cachedPrice).toFixed(3) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {Number(m.cacheCreationPrice ?? 0) > 0 ? Number(m.cacheCreationPrice).toFixed(3) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{m.context || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(m.allowedGroups || "").split(",").filter(Boolean).map((g) => (
                        <Badge key={g} variant="outline">{g.trim()}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch checked={m.status === "online"} onCheckedChange={() => toggleStatus(m)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(m)}><Edit3 /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(m)}><Trash2 /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑模型映射</DialogTitle>
          </DialogHeader>
          {editing && (
            <ModelForm
              upstreams={upstreamList}
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

function ModelForm({
  upstreams,
  submitting,
  onCancel,
  onSubmit,
  initial,
}: {
  upstreams: AdminUpstream[];
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  initial?: AdminModelMapping;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="modelId">对外模型 ID</Label>
          <Input id="modelId" name="modelId" required defaultValue={initial?.modelId} placeholder="claude-sonnet-4-6" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vendor">厂商</Label>
          <Input id="vendor" name="vendor" required defaultValue={initial?.vendor} placeholder="Anthropic" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>上游</Label>
          <Select name="upstreamId" defaultValue={initial ? String(initial.upstreamId) : (upstreams[0] ? String(upstreams[0].id) : "")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {upstreams.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="upstreamModelName">上游模型名</Label>
          <Input id="upstreamModelName" name="upstreamModelName" required defaultValue={initial?.upstreamModelName} placeholder="claude-3-5-sonnet-latest" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="inputPrice">输入价 ($/1M tokens)</Label>
          <Input id="inputPrice" name="inputPrice" defaultValue={initial?.inputPrice ?? "1"} placeholder="2.50" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="outputPrice">输出价 ($/1M tokens)</Label>
          <Input id="outputPrice" name="outputPrice" defaultValue={initial?.outputPrice ?? "1"} placeholder="10.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="context">上下文</Label>
          <Input id="context" name="context" type="number" defaultValue={initial?.context ?? 0} placeholder="200000" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cachedPrice">缓存输入价 ($/1M tokens)</Label>
          <Input id="cachedPrice" name="cachedPrice" defaultValue={initial?.cachedPrice ?? "0"} placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cacheCreationPrice">写缓存价 ($/1M tokens)</Label>
          <Input id="cacheCreationPrice" name="cacheCreationPrice" defaultValue={initial?.cacheCreationPrice ?? "0"} placeholder="0" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>状态</Label>
          <Select name="status" defaultValue={initial?.status ?? "online"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="online">在线</SelectItem>
              <SelectItem value="offline">离线</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="allowedGroups">开放分组 (CSV)</Label>
          <Input id="allowedGroups" name="allowedGroups" defaultValue={initial?.allowedGroups ?? "default"} placeholder="default,vip" />
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
