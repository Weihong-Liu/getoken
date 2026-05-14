import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { demoAdminModels, type AdminModel } from "@/lib/mockAdmin";

export default function ModelsPage() {
  const [models, setModels] = useState<AdminModel[]>(demoAdminModels);

  function updateRatio(id: string, field: "inputRatio" | "outputRatio", value: number) {
    setModels((list) => list.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  }

  function toggleStatus(id: string) {
    setModels((list) => list.map((m) => (m.id === id ? { ...m, status: m.status === "online" ? "offline" : "online" } : m)));
  }

  return (
    <>
      <PageHeader title="模型管理" description="设置每个模型的价格倍率、所属渠道与开放分组。" />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>模型 ID</TableHead>
              <TableHead>厂商</TableHead>
              <TableHead>渠道数</TableHead>
              <TableHead className="w-32">输入倍率</TableHead>
              <TableHead className="w-32">输出倍率</TableHead>
              <TableHead>开放分组</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.id}</TableCell>
                <TableCell>{m.vendor}</TableCell>
                <TableCell className="tabular-nums">{m.channels}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step={0.1}
                    value={m.inputRatio}
                    onChange={(e) => updateRatio(m.id, "inputRatio", Number(e.target.value))}
                    className="h-8 w-24 text-right tabular-nums"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step={0.1}
                    value={m.outputRatio}
                    onChange={(e) => updateRatio(m.id, "outputRatio", Number(e.target.value))}
                    className="h-8 w-24 text-right tabular-nums"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {m.groups.map((g) => (
                      <Badge key={g} variant="outline">{g}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Switch checked={m.status === "online"} onCheckedChange={() => toggleStatus(m.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
