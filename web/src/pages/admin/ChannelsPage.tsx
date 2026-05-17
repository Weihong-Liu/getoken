import { useState } from "react";
import useSWR from "swr";
import { Activity, KeyRound, Plus, Power, PowerOff, RefreshCw, Trash2, Server, Edit3, Loader2, Tags, Download } from "lucide-react";
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
import { apiFetch, fetcher, type AdminUpstream, type AdminUpstreamAccount } from "@/lib/api";
import { timeAgo } from "@/lib/utils";

const statusMap = {
  online: { label: "在线", variant: "success" as const },
  degraded: { label: "缓慢", variant: "warning" as const },
  offline: { label: "离线", variant: "danger" as const },
};

const accountStatusMap = {
  online: { label: "在线", variant: "success" as const },
  degraded: { label: "缓慢", variant: "warning" as const },
  offline: { label: "离线", variant: "danger" as const },
  cooling: { label: "冷却", variant: "secondary" as const },
};

const UPSTREAM_TYPES = ["openai", "anthropic", "gemini", "oneapi", "newapi", "sub2api"];

export default function ChannelsPage() {
  const { data, mutate } = useSWR<AdminUpstream[]>("/admin/upstreams", fetcher, {
    revalidateOnFocus: false,
  });
  const { data: accountsData, mutate: mutateAccounts } = useSWR<AdminUpstreamAccount[]>("/admin/upstream-accounts", fetcher, {
    revalidateOnFocus: false,
  });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUpstream | null>(null);
  const [accountPanel, setAccountPanel] = useState<AdminUpstream | null>(null);
  const [accountForm, setAccountForm] = useState<{ upstream: AdminUpstream; account?: AdminUpstreamAccount } | null>(null);
  const [checkingAccountId, setCheckingAccountId] = useState<number | null>(null);
  const [authorizingAccountId, setAuthorizingAccountId] = useState<number | null>(null);
  const [refreshingAccountId, setRefreshingAccountId] = useState<number | null>(null);
  const [checkingUpstreamId, setCheckingUpstreamId] = useState<number | null>(null);
  const [syncingUpstreamId, setSyncingUpstreamId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const upstreams = data ?? [];
  const accounts = accountsData ?? [];

  function accountsFor(upstreamId: number) {
    return accounts.filter((account) => account.upstreamId === upstreamId);
  }

  function toggleSelected(id: number, checked: boolean) {
    setSelectedIds((current) => checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id));
  }

  async function onBulkStatus(status: "online" | "offline") {
    if (selectedIds.length === 0) {
      toast.error("请先选择上游");
      return;
    }
    setBulkBusy(true);
    try {
      const res = await apiFetch<{ affected: number }>("/admin/upstreams/bulk-status", {
        method: "POST",
        body: JSON.stringify({ ids: selectedIds, status }),
      });
      toast.success(`已更新 ${res.affected} 个上游`);
      setSelectedIds([]);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "批量操作失败");
    } finally {
      setBulkBusy(false);
    }
  }

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
	          tags: String(fd.get("tags") || ""),
	          priority: Number(fd.get("priority") || 5),
	          weight: Number(fd.get("weight") || 5),
	          autoDisable: fd.get("autoDisable") === "on",
	          failureThreshold: Number(fd.get("failureThreshold") || 3),
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
	      tags: String(fd.get("tags") || ""),
	      priority: Number(fd.get("priority") || editing.priority),
	      weight: Number(fd.get("weight") || editing.weight),
	      autoDisable: fd.get("autoDisable") === "on",
	      failureThreshold: Number(fd.get("failureThreshold") || editing.failureThreshold || 3),
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

  async function onAccountSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accountForm) return;
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    const body = {
      upstreamId: accountForm.upstream.id,
      name: String(fd.get("name")),
      accountType: String(fd.get("accountType") || "apikey"),
      apiKey: String(fd.get("apiKey") || ""),
      oauthAccessToken: String(fd.get("oauthAccessToken") || ""),
      oauthRefreshToken: String(fd.get("oauthRefreshToken") || ""),
      oauthExpiresAt: String(fd.get("oauthExpiresAt") || ""),
      proxyUrl: String(fd.get("proxyUrl") || ""),
      status: String(fd.get("status") || "online"),
      priority: Number(fd.get("priority") || 10),
      weight: Number(fd.get("weight") || 10),
      rpmLimit: Number(fd.get("rpmLimit") || 0),
      tpmLimit: Number(fd.get("tpmLimit") || 0),
      concurrencyLimit: Number(fd.get("concurrencyLimit") || 0),
      note: String(fd.get("note") || ""),
    };
    try {
      if (accountForm.account) {
        await apiFetch(`/admin/upstream-accounts/${accountForm.account.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast.success("账号已保存");
      } else {
        await apiFetch("/admin/upstream-accounts", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success("账号已添加");
      }
      setAccountForm(null);
      mutateAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function onAccountDelete(account: AdminUpstreamAccount) {
    if (!confirm(`确认删除账号「${account.name}」?`)) return;
    try {
      await apiFetch(`/admin/upstream-accounts/${account.id}`, { method: "DELETE" });
      toast.success("账号已删除");
      mutateAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function onAccountCheck(account: AdminUpstreamAccount) {
    setCheckingAccountId(account.id);
    try {
      await apiFetch(`/admin/upstream-accounts/${account.id}/check`, { method: "POST" });
      toast.success("检测完成");
      mutateAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "检测失败");
    } finally {
      setCheckingAccountId(null);
    }
  }

  async function onAccountRecover(account: AdminUpstreamAccount) {
    try {
      await apiFetch(`/admin/upstream-accounts/${account.id}/recover`, { method: "POST" });
      toast.success("账号已恢复调度");
      mutateAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "恢复失败");
    }
  }

  async function onOAuthRefresh(account: AdminUpstreamAccount) {
    setRefreshingAccountId(account.id);
    try {
      await apiFetch(`/admin/upstream-accounts/${account.id}/refresh-oauth`, { method: "POST" });
      toast.success("OAuth Token 已刷新");
      mutateAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "刷新失败");
    } finally {
      setRefreshingAccountId(null);
    }
  }

  async function onOAuthStart(account: AdminUpstreamAccount) {
    setAuthorizingAccountId(account.id);
    try {
      const res = await apiFetch<{ authUrl: string }>(`/admin/upstream-accounts/${account.id}/oauth/start`, { method: "POST" });
      window.open(res.authUrl, "_blank", "noopener,noreferrer");
      toast.success("授权页面已打开");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成授权链接失败");
    } finally {
      setAuthorizingAccountId(null);
    }
  }

  async function onCheckUpstream(u: AdminUpstream) {
    setCheckingUpstreamId(u.id);
    try {
      const res = await apiFetch<{ latencyMs: number; models: number }>(`/admin/upstreams/${u.id}/check`, { method: "POST" });
      toast.success(`检测完成：${res.latencyMs}ms / ${res.models} 个模型`);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "检测失败");
      mutate();
    } finally {
      setCheckingUpstreamId(null);
    }
  }

  async function onSyncModels(u: AdminUpstream) {
    if (!confirm(`从「${u.name}」同步模型？已有模型会更新上游指向和上下文。`)) return;
    setSyncingUpstreamId(u.id);
    try {
      const res = await apiFetch<{ created: number; updated: number; skipped: number; remote: number }>(`/admin/upstreams/${u.id}/sync-models`, {
        method: "POST",
        body: JSON.stringify({ overwrite: true, updatePrices: true, allowedGroups: "default,vip", status: "online" }),
      });
      toast.success(`同步完成：远端 ${res.remote} / 新增 ${res.created} / 更新 ${res.updated} / 跳过 ${res.skipped}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "同步失败");
    } finally {
      setSyncingUpstreamId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="上游网关"
        description="管理上游 API 网关 (Upstream),配置接入类型、密钥与调度策略。"
	        actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={bulkBusy || selectedIds.length === 0} onClick={() => onBulkStatus("online")}>
                <Power className="size-4" />批量启用
              </Button>
              <Button variant="outline" disabled={bulkBusy || selectedIds.length === 0} onClick={() => onBulkStatus("offline")}>
                <PowerOff className="size-4" />批量禁用
              </Button>
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
            </div>
	        }
	      />

      <Card>
        <Table>
          <TableHeader>
	            <TableRow>
	              <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="size-4 rounded border"
                    checked={upstreams.length > 0 && selectedIds.length === upstreams.length}
                    onChange={(e) => setSelectedIds(e.currentTarget.checked ? upstreams.map((u) => u.id) : [])}
                  />
                </TableHead>
	              <TableHead>名称</TableHead>
	              <TableHead>类型</TableHead>
	              <TableHead>Base URL</TableHead>
              <TableHead>密钥</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>账号池</TableHead>
              <TableHead>优先级 / 权重</TableHead>
              <TableHead className="text-right">延迟</TableHead>
              <TableHead>最近检测</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {upstreams.length === 0 && (
              <TableRow>
                <TableCell colSpan={11}>
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <Server className="mx-auto size-8 mb-2 opacity-50" />
                    还没有上游网关,点击右上角添加。
                  </div>
                </TableCell>
              </TableRow>
            )}
	            {upstreams.map((u) => (
	              <TableRow key={u.id}>
	                <TableCell>
                    <input
                      type="checkbox"
                      className="size-4 rounded border"
                      checked={selectedIds.includes(u.id)}
                      onChange={(e) => toggleSelected(u.id, e.currentTarget.checked)}
                    />
                  </TableCell>
	                <TableCell className="font-medium">{u.name}</TableCell>
	                <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="secondary" className="w-fit font-mono text-xs">{u.type}</Badge>
                      {u.tags && (
                        <div className="flex max-w-44 flex-wrap gap-1">
                          {u.tags.split(",").filter(Boolean).slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px]">{tag.trim()}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                <TableCell><code className="text-xs font-mono text-muted-foreground">{u.baseUrl}</code></TableCell>
                <TableCell><code className="text-xs font-mono text-muted-foreground">{u.apiKeyMask || "—"}</code></TableCell>
                <TableCell><Badge variant={statusMap[u.status].variant}>{statusMap[u.status].label}</Badge></TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setAccountPanel(u)}>
                    <KeyRound className="size-3.5" />
                    {accountsFor(u.id).length || "未配置"}
                  </Button>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">{u.priority} / {u.weight}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{u.latencyMs > 0 ? `${u.latencyMs}ms` : "—"}</TableCell>
	                <TableCell className="text-xs text-muted-foreground">
                    <div>{u.lastCheckAt ? timeAgo(u.lastCheckAt) : "—"}</div>
                    {u.failureCount > 0 && <div className="text-danger">失败 {u.failureCount}/{u.failureThreshold || 3}</div>}
                  </TableCell>
	                <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onCheckUpstream(u)} title="检测上游" disabled={checkingUpstreamId === u.id}>
                      {checkingUpstreamId === u.id ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onSyncModels(u)} title="同步模型" disabled={syncingUpstreamId === u.id}>
                      {syncingUpstreamId === u.id ? <Loader2 className="animate-spin" /> : <Download />}
                    </Button>
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

      <Dialog open={!!accountPanel} onOpenChange={(v) => { if (!v) setAccountPanel(null); }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{accountPanel?.name} · 账号池</DialogTitle>
            <DialogDescription>同一上游可以挂多把 Key,网关会按优先级和权重选择可用账号。</DialogDescription>
          </DialogHeader>
          {accountPanel && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="size-4 text-primary" />
                  <span>在线 {accountsFor(accountPanel.id).filter((account) => account.status === "online").length}</span>
                  <span>·</span>
                  <span>总计 {accountsFor(accountPanel.id).length}</span>
                </div>
                <Button size="sm" onClick={() => setAccountForm({ upstream: accountPanel })}>
                  <Plus className="size-4" />新增账号
                </Button>
              </div>
              <div className="max-h-[58vh] overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>账号</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>密钥</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>权重</TableHead>
                      <TableHead>限流</TableHead>
                      <TableHead className="text-right">延迟</TableHead>
                      <TableHead>最近使用</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountsFor(accountPanel.id).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <div className="py-8 text-center text-sm text-muted-foreground">
                            <KeyRound className="mx-auto mb-2 size-8 opacity-50" />
                            暂无账号,会继续使用上游自身的 API Key。
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {accountsFor(accountPanel.id).map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <div className="font-medium">{account.name}</div>
                          {account.note && <div className="mt-1 text-xs text-muted-foreground">{account.note}</div>}
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="font-mono text-[10px]">{account.accountType || "apikey"}</Badge></TableCell>
                        <TableCell><code className="text-xs text-muted-foreground">{account.apiKeyMask || account.oauthAccessTokenMask || "—"}</code></TableCell>
                        <TableCell><Badge variant={accountStatusMap[account.status].variant}>{accountStatusMap[account.status].label}</Badge></TableCell>
                        <TableCell className="text-xs tabular-nums text-muted-foreground">{account.priority} / {account.weight}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {account.rpmLimit || account.tpmLimit || account.concurrencyLimit
                            ? `${account.rpmLimit || "∞"} RPM · ${account.concurrencyLimit || "∞"} 并发`
                            : "不限"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{account.latencyMs > 0 ? `${account.latencyMs}ms` : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{account.lastUsedAt ? timeAgo(account.lastUsedAt) : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" title="检测" onClick={() => onAccountCheck(account)} disabled={checkingAccountId === account.id}>
                            {checkingAccountId === account.id ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                          </Button>
	                          <Button variant="ghost" size="icon" title="恢复调度" onClick={() => onAccountRecover(account)}>
	                            <Power />
	                          </Button>
                            {account.accountType.includes("oauth") && (
                              <Button variant="ghost" size="icon" title="授权 OAuth" onClick={() => onOAuthStart(account)} disabled={authorizingAccountId === account.id}>
                                {authorizingAccountId === account.id ? <Loader2 className="animate-spin" /> : <KeyRound />}
                              </Button>
                            )}
                            {(account.accountType.includes("oauth") || account.oauthRefreshTokenMask) && (
                              <Button variant="ghost" size="icon" title="刷新 OAuth" onClick={() => onOAuthRefresh(account)} disabled={refreshingAccountId === account.id}>
                                {refreshingAccountId === account.id ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                              </Button>
                            )}
	                          <Button variant="ghost" size="icon" title="编辑" onClick={() => setAccountForm({ upstream: accountPanel, account })}>
                            <Edit3 />
                          </Button>
                          <Button variant="ghost" size="icon" title="删除" onClick={() => onAccountDelete(account)}>
                            <Trash2 />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!accountForm} onOpenChange={(v) => { if (!v) setAccountForm(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{accountForm?.account ? "编辑账号" : "新增账号"}</DialogTitle>
            <DialogDescription>{accountForm?.upstream.name} 的账号池凭证,保存后会参与网关调度。</DialogDescription>
          </DialogHeader>
          {accountForm && (
            <UpstreamAccountForm
	              submitting={submitting}
	              initial={accountForm.account}
	              requireKey={false}
	              onCancel={() => setAccountForm(null)}
              onSubmit={onAccountSubmit}
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
      <div className="space-y-2">
        <Label htmlFor="tags">标签</Label>
        <div className="relative">
          <Tags className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input id="tags" name="tags" className="pl-9" defaultValue={initial?.tags ?? ""} placeholder="official,claude,backup" />
        </div>
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
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label htmlFor="autoDisable" className="cursor-pointer">自动禁用故障上游</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">连续检测失败达到阈值后切为离线。</p>
          </div>
          <input
            id="autoDisable"
            name="autoDisable"
            type="checkbox"
            className="size-4 rounded border"
            defaultChecked={initial?.autoDisable ?? true}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="failureThreshold">失败阈值</Label>
          <Input id="failureThreshold" name="failureThreshold" type="number" min={1} defaultValue={initial?.failureThreshold ?? 3} />
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

function UpstreamAccountForm({
  submitting,
  onCancel,
  onSubmit,
  initial,
  requireKey,
}: {
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  initial?: AdminUpstreamAccount;
  requireKey?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="account-name">账号名称</Label>
          <Input id="account-name" name="name" required defaultValue={initial?.name} placeholder="比如:claude-main-01" />
        </div>
        <div className="space-y-2">
          <Label>账号类型</Label>
          <Select name="accountType" defaultValue={initial?.accountType ?? "apikey"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="apikey">API Key</SelectItem>
              <SelectItem value="setup-token">Setup Token</SelectItem>
              <SelectItem value="oauth">OAuth</SelectItem>
              <SelectItem value="oauth_code">OAuth Code</SelectItem>
              <SelectItem value="oauth_setup_token">OAuth Setup Token</SelectItem>
              <SelectItem value="service_account">Service Account</SelectItem>
              <SelectItem value="upstream">Upstream</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>状态</Label>
          <Select name="status" defaultValue={initial?.status ?? "online"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="online">在线</SelectItem>
              <SelectItem value="degraded">缓慢</SelectItem>
              <SelectItem value="cooling">冷却</SelectItem>
              <SelectItem value="offline">离线</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-proxy-url">代理 URL</Label>
          <Input id="account-proxy-url" name="proxyUrl" defaultValue={initial?.proxyUrl ?? ""} placeholder="http://user:pass@host:port" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="account-api-key">API Key {requireKey ? "" : "(留空不修改)"}</Label>
        <Input id="account-api-key" name="apiKey" type="password" required={requireKey} placeholder={initial?.apiKeyMask ?? "sk-..."} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="account-access-token">OAuth Access Token</Label>
          <Input id="account-access-token" name="oauthAccessToken" type="password" placeholder={initial?.oauthAccessTokenMask ?? "可选"} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-refresh-token">OAuth Refresh Token</Label>
          <Input id="account-refresh-token" name="oauthRefreshToken" type="password" placeholder={initial?.oauthRefreshTokenMask ?? "可选"} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="account-oauth-expires">OAuth 过期时间</Label>
        <Input id="account-oauth-expires" name="oauthExpiresAt" defaultValue={initial?.oauthExpiresAt ?? ""} placeholder="2026-05-17T12:00:00Z" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="account-priority">优先级</Label>
          <Input id="account-priority" name="priority" type="number" defaultValue={initial?.priority ?? 10} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-weight">权重</Label>
          <Input id="account-weight" name="weight" type="number" defaultValue={initial?.weight ?? 10} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="account-rpm">RPM 限制</Label>
          <Input id="account-rpm" name="rpmLimit" type="number" min={0} defaultValue={initial?.rpmLimit ?? 0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-tpm">TPM 限制</Label>
          <Input id="account-tpm" name="tpmLimit" type="number" min={0} defaultValue={initial?.tpmLimit ?? 0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-concurrency">并发限制</Label>
          <Input id="account-concurrency" name="concurrencyLimit" type="number" min={0} defaultValue={initial?.concurrencyLimit ?? 0} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="account-note">备注</Label>
        <Input id="account-note" name="note" defaultValue={initial?.note} placeholder="可选" />
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
