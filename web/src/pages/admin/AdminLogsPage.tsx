import { useMemo, useState } from "react";
import useSWR from "swr";
import { Search, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { fetcher, type LogEntry, type Page } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/utils";

const PAGE_SIZE = 20;
const EMPTY_LOGS: LogEntry[] = [];

export default function AdminLogsPage() {
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));
  if (model !== "all") params.set("model", model);
  if (status !== "all") params.set("status", status);
  if (query) params.set("q", query);

  const { data } = useSWR<Page<LogEntry>>(`/admin/logs?${params}`, fetcher, {
    revalidateOnFocus: false,
  });

  const items = data?.items ?? EMPTY_LOGS;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const models = useMemo(
    () => Array.from(new Set(items.map((l) => l.modelName).filter(Boolean))),
    [items],
  );

  function exportCsv() {
    const exportParams = new URLSearchParams();
    if (model !== "all") exportParams.set("model", model);
    if (status !== "all") exportParams.set("status", status);
    if (query) exportParams.set("q", query);
    const url = `/api/admin/logs/export?${exportParams}`;
    window.open(url, "_blank");
  }

  return (
    <>
      <PageHeader
        title="调用日志"
        description="全平台调用日志,可按模型、状态过滤并导出 CSV。"
        actions={
          <Button variant="outline" onClick={exportCsv}><Download />导出 CSV</Button>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="搜索模型 / Key 名称" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Select value={model} onValueChange={(v) => { setModel(v); setPage(1); }}>
            <SelectTrigger className="md:w-52"><SelectValue placeholder="所有模型" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有模型</SelectItem>
              {models.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="md:w-40"><SelectValue placeholder="所有状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有状态</SelectItem>
              <SelectItem value="success">成功</SelectItem>
              <SelectItem value="error">失败</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>模型</TableHead>
              <TableHead>Key</TableHead>
              <TableHead className="text-right" title="未命中缓存的输入">输入</TableHead>
              <TableHead className="text-right" title="缓存命中">缓存</TableHead>
              <TableHead className="text-right" title="写入缓存的 token">写缓存</TableHead>
              <TableHead className="text-right">输出</TableHead>
              <TableHead title="思考强度 + 推理消耗 token">思考</TableHead>
              <TableHead className="text-right">消耗</TableHead>
              <TableHead className="text-right">延迟</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={11}><div className="py-10 text-center text-sm text-muted-foreground">没有匹配的日志</div></TableCell>
              </TableRow>
            )}
            {items.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleString("zh-CN", { hour12: false })}
                </TableCell>
                <TableCell className="font-mono text-xs">{l.modelName}</TableCell>
                <TableCell className="text-sm">{l.tokenName}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{formatNumber(l.promptTokens)}</TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{l.cachedTokens > 0 ? formatNumber(l.cachedTokens) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{l.cacheCreationTokens > 0 ? formatNumber(l.cacheCreationTokens) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{formatNumber(l.completionTokens)}</TableCell>
                <TableCell>
                  {l.reasoningEffort || l.reasoningTokens > 0 ? (
                    <div className="flex items-center gap-1.5">
                      {l.reasoningEffort && <Badge variant="outline" className="text-[10px]">{l.reasoningEffort}</Badge>}
                      {l.reasoningTokens > 0 && (
                        <span className="text-xs tabular-nums text-muted-foreground">{formatNumber(l.reasoningTokens)}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">{formatCurrency(l.quota)}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{l.latencyMs}ms</TableCell>
                <TableCell>
                  {l.status === "success" ? (
                    <Badge variant="success">成功</Badge>
                  ) : (
                    <Badge variant="danger" title={l.error}>失败</Badge>
                  )}
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
    </>
  );
}
