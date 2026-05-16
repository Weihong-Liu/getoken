import { useState } from "react";
import useSWR from "swr";
import { Plus, Copy, Power, PowerOff, Trash2, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { apiFetch, fetcher, type Token } from "@/lib/api";
import { demoTokens } from "@/lib/mock";
import { copyToClipboard, formatCurrency, timeAgo } from "@/lib/utils";

export default function TokensPage() {
  const { data, mutate } = useSWR<Token[]>("/token", fetcher, {
    fallbackData: demoTokens,
    revalidateOnFocus: false,
  });
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const tokens = data ?? [];

  async function onCopy(key: string) {
    await copyToClipboard(key);
    toast.success("已复制");
  }

  async function onToggleStatus(t: Token) {
    try {
      await apiFetch(`/token/${t.id}`, { method: "PUT", body: JSON.stringify({ status: t.status === 1 ? 0 : 1 }) });
      toast.success(t.status === 1 ? "已禁用" : "已启用");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function onDelete(t: Token) {
    if (!confirm(`确认删除「${t.name}」?`)) return;
    try {
      await apiFetch(`/token/${t.id}`, { method: "DELETE" });
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
      const res = await apiFetch<Token>("/token", {
        method: "POST",
        body: JSON.stringify({
          name: String(fd.get("name")),
          remainQuota: String(fd.get("remainQuota") || "0"),
          unlimitedQuota: fd.get("unlimitedQuota") === "on",
          expiredAt: Number(fd.get("expiredTime") || 0),
          ipWhitelist: String(fd.get("ipWhitelist") || ""),
        }),
      });
      toast.success("创建成功，请妥善保存密钥（仅此一次显示）");
      setCreating(false);
      if (res.key) setNewKey(res.key);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="API Keys"
        description="管理你的访问令牌,可以单独设定额度、过期时间与 IP 白名单。"
        actions={
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button><Plus />新建 Key</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建 API Key</DialogTitle>
                <DialogDescription>建议为不同业务创建独立的 Key,出问题时可以单独禁用。</DialogDescription>
              </DialogHeader>
              <form onSubmit={onCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">名称</Label>
                  <Input id="name" name="name" required placeholder="比如:线上服务" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="remainQuota">额度 ($)</Label>
                    <Input id="remainQuota" name="remainQuota" type="number" step="0.01" placeholder="0 表示无限" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiredTime">过期时间 (unix s)</Label>
                    <Input id="expiredTime" name="expiredTime" type="number" placeholder="0 表示永不过期" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ipWhitelist">IP 白名单 (可选,每行一个)</Label>
                  <textarea
                    id="ipWhitelist"
                    name="ipWhitelist"
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={`1.2.3.4\n5.6.7.0/24`}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="unlimitedQuota" className="cursor-pointer">无限额度</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">忽略「额度」字段,共享账户余额</p>
                  </div>
                  <Switch id="unlimitedQuota" name="unlimitedQuota" />
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

      <Dialog open={!!newKey} onOpenChange={(v) => { if (!v) setNewKey(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>密钥已创建</DialogTitle>
            <DialogDescription>请立刻保存下面的密钥，离开此页面后将无法再次查看。</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md bg-muted/40 p-3">
            <code className="flex-1 break-all text-xs font-mono">{newKey}</code>
            <Button size="sm" variant="outline" onClick={() => newKey && onCopy(newKey)}>
              <Copy /> 复制
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)}>我已保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>密钥</TableHead>
              <TableHead>剩余额度</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <KeyRound className="mx-auto size-8 mb-2 opacity-50" />
                    还没有 API Key,点击右上角创建第一个吧。
                  </div>
                </TableCell>
              </TableRow>
            )}
            {tokens.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>
                  <code className="text-xs font-mono text-muted-foreground">{t.keyPrefix}…</code>
                </TableCell>
                <TableCell>{t.unlimitedQuota ? <Badge variant="secondary">无限</Badge> : formatCurrency(Number(t.remainQuota))}</TableCell>
                <TableCell>
                  {t.status === 1 ? <Badge variant="success">启用</Badge> : <Badge variant="danger">已禁</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{timeAgo(t.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onToggleStatus(t)} title={t.status === 1 ? "禁用" : "启用"}>
                      {t.status === 1 ? <PowerOff /> : <Power />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(t)} title="删除">
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
