import { useState } from "react";
import { Plus, Power, PowerOff, RefreshCw, Trash2, Server } from "lucide-react";
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
import { demoAdminChannels, type AdminChannel } from "@/lib/mockAdmin";

const statusMap = {
  online: { label: "在线", variant: "success" as const },
  degraded: { label: "缓慢", variant: "warning" as const },
  offline: { label: "离线", variant: "danger" as const },
};

export default function ChannelsPage() {
  const [channels, setChannels] = useState<AdminChannel[]>(demoAdminChannels);
  const [open, setOpen] = useState(false);

  function ping() {
    toast.success("健康检测已启动,稍后刷新查看结果");
  }

  function toggleStatus(id: number) {
    setChannels((list) => list.map((c) => (c.id === id ? { ...c, status: c.status === "offline" ? "online" : "offline" } : c)));
  }

  function onDelete(id: number) {
    if (!confirm("确认删除该渠道?")) return;
    setChannels((list) => list.filter((c) => c.id !== id));
    toast.success("已删除");
  }

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setChannels((list) => [
      ...list,
      {
        id: Math.max(0, ...list.map((c) => c.id)) + 1,
        name: String(fd.get("name")),
        type: String(fd.get("type")),
        status: "online",
        models: String(fd.get("models")).split(/[\s,]+/).filter(Boolean),
        keys: String(fd.get("keys") ?? "").split(/\s+/).filter(Boolean).length || 1,
        priority: Number(fd.get("priority") || 5),
        weight: Number(fd.get("weight") || 5),
        latencyMs: 0,
      },
    ]);
    setOpen(false);
    toast.success("渠道已创建");
  }

  return (
    <>
      <PageHeader
        title="渠道管理"
        description="管理上游 API 渠道、多 key 轮询与健康检测。"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={ping}><RefreshCw />健康检测</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus />新增渠道</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新增渠道</DialogTitle>
                  <DialogDescription>每个渠道对应一组上游 API key,系统会自动轮询。</DialogDescription>
                </DialogHeader>
                <form onSubmit={onCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="name">名称</Label>
                      <Input id="name" name="name" required placeholder="比如:Anthropic 官方" />
                    </div>
                    <div className="space-y-2">
                      <Label>类型</Label>
                      <Select name="type" defaultValue="openai">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="gemini">Gemini</SelectItem>
                          <SelectItem value="azure">Azure OpenAI</SelectItem>
                          <SelectItem value="deepseek">DeepSeek</SelectItem>
                          <SelectItem value="moonshot">Moonshot</SelectItem>
                          <SelectItem value="qwen">Qwen / DashScope</SelectItem>
                          <SelectItem value="siliconflow">SiliconFlow</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="models">支持模型 (逗号或换行分隔)</Label>
                    <textarea
                      id="models"
                      name="models"
                      rows={2}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                      placeholder="claude-sonnet-4-6, claude-opus-4-7"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="keys">API Keys (每行一个)</Label>
                    <textarea
                      id="keys"
                      name="keys"
                      rows={4}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                      placeholder={`sk-xxxxxxxxxxxxxxxxx\nsk-yyyyyyyyyyyyyyyyy`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="priority">优先级 (数字越大越优先)</Label>
                      <Input id="priority" name="priority" type="number" defaultValue={5} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weight">权重</Label>
                      <Input id="weight" name="weight" type="number" defaultValue={5} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
                    <Button type="submit">创建</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>Keys</TableHead>
              <TableHead>优先级 / 权重</TableHead>
              <TableHead>支持模型</TableHead>
              <TableHead className="text-right">延迟</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <Server className="mx-auto size-8 mb-2 opacity-50" />
                    还没有渠道,点击右上角添加。
                  </div>
                </TableCell>
              </TableRow>
            )}
            {channels.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell><Badge variant="secondary" className="font-mono text-xs">{c.type}</Badge></TableCell>
                <TableCell><Badge variant={statusMap[c.status].variant}>{statusMap[c.status].label}</Badge></TableCell>
                <TableCell className="tabular-nums">{c.keys}</TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">{c.priority} / {c.weight}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {c.models.slice(0, 3).map((m) => (
                      <Badge key={m} variant="outline" className="font-mono text-[10px]">{m}</Badge>
                    ))}
                    {c.models.length > 3 && <Badge variant="outline" className="text-[10px]">+{c.models.length - 3}</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">{c.latencyMs > 0 ? `${c.latencyMs}ms` : "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => toggleStatus(c.id)}>
                    {c.status === "offline" ? <Power /> : <PowerOff />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(c.id)}>
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
