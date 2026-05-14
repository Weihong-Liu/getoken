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
import { fetcher, type LogEntry } from "@/lib/api";
import { demoLogs } from "@/lib/mock";
import { formatCurrency, formatNumber } from "@/lib/utils";

const PAGE_SIZE = 15;

export default function LogsPage() {
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data } = useSWR<{ items: LogEntry[]; total: number }>("/log?limit=200", fetcher, {
    fallbackData: { items: demoLogs, total: demoLogs.length },
    revalidateOnFocus: false,
  });

  const items = data?.items ?? [];
  const models = useMemo(() => Array.from(new Set(items.map((l) => l.modelName))), [items]);

  const filtered = useMemo(() => {
    return items.filter((l) => {
      if (model !== "all" && l.modelName !== model) return false;
      if (status !== "all" && l.status !== status) return false;
      if (query && !`${l.modelName} ${l.tokenName}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [items, model, status, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    const headers = ["time", "model", "token", "promptTokens", "completionTokens", "cost", "latencyMs", "status"];
    const rows = filtered.map((l) => [
      l.createdAt,
      l.modelName,
      l.tokenName,
      l.promptTokens,
      l.completionTokens,
      l.quota,
      l.latencyMs,
      l.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `getoken-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="调用日志"
        description="实时查看每一次请求的 token 消耗、延迟与状态。"
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
              <TableHead className="text-right">输入</TableHead>
              <TableHead className="text-right">输出</TableHead>
              <TableHead className="text-right">消耗</TableHead>
              <TableHead className="text-right">延迟</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}><div className="py-10 text-center text-sm text-muted-foreground">没有匹配的日志</div></TableCell>
              </TableRow>
            )}
            {pageItems.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleString("zh-CN", { hour12: false })}
                </TableCell>
                <TableCell className="font-mono text-xs">{l.modelName}</TableCell>
                <TableCell className="text-sm">{l.tokenName}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{formatNumber(l.promptTokens)}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{formatNumber(l.completionTokens)}</TableCell>
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
          <span>共 {filtered.length} 条记录</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
            <span className="tabular-nums">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
          </div>
        </div>
      </Card>
    </>
  );
}
