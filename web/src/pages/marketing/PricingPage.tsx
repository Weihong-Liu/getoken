import { useMemo, useState, type ComponentType } from "react";
import useSWR from "swr";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  DatabaseZap,
  Layers3,
  Search,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { fetcher, type ModelInfo } from "@/lib/api";
import { cn } from "@/lib/utils";

type Plan = {
  name: string;
  tagline: string;
  price: string;
  unit: string;
  highlight?: boolean;
  badge?: string;
  features: string[];
  cta: string;
};

const plans: Plan[] = [
  {
    name: "免费",
    tagline: "适合体验、调试和低频个人项目",
    price: "$0",
    unit: "/ 月",
    badge: "体验",
    features: ["注册赠送 $1 额度", "基础模型可用", "调用日志保留 7 天", "社区支持"],
    cta: "立即开始",
  },
  {
    name: "标准",
    tagline: "适合个人开发者、工具站和小团队",
    price: "$0.5",
    unit: "× 倍率起",
    badge: "推荐",
    highlight: true,
    features: ["核心模型开放", "多 key 轮询与失败重试", "调用日志保留 30 天", "邀请返利 5%"],
    cta: "开始接入",
  },
  {
    name: "企业",
    tagline: "适合商用平台、内部系统和高可用场景",
    price: "定制",
    unit: "按用量协商",
    badge: "SLA",
    features: ["专属上游通道", "SLA 99.9% 保障", "团队成员与权限管理", "技术对接与工单优先"],
    cta: "联系我们",
  },
];

const EMPTY_MODELS: ModelInfo[] = [];

export default function PricingPage() {
  const [query, setQuery] = useState("");
  const { data, isLoading } = useSWR<ModelInfo[]>("/public/models", fetcher, {
    revalidateOnFocus: false,
  });
  const models = data ?? EMPTY_MODELS;
  const vendorCount = new Set(models.map((model) => model.vendor).filter(Boolean)).size;
  const billingMetrics = [
    { label: "余额有效期", value: "永久", hint: "充值后不清零", icon: Wallet, tone: "success" },
    { label: "最低倍率", value: "0.2x", hint: "按模型独立计费", icon: CircleDollarSign, tone: "default" },
    { label: "模型覆盖", value: String(models.length), hint: `${vendorCount || 0} 个上游厂商`, icon: Layers3, tone: "default" },
    { label: "日志保留", value: "30天", hint: "标准版起", icon: Clock3, tone: "warning" },
  ] satisfies PricingMetricProps[];

  const filtered = useMemo(
    () =>
      models.filter(
        (model) =>
          query === "" ||
          model.id.toLowerCase().includes(query.toLowerCase()) ||
          model.vendor.toLowerCase().includes(query.toLowerCase()),
      ),
    [models, query],
  );

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-16 md:px-6 md:pb-12 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p data-reveal className="text-sm font-medium text-primary">定价方案</p>
          <h1 data-reveal data-delay="100" className="mt-2 text-4xl font-semibold md:text-5xl">
            按量计费,余额永久有效
          </h1>
          <p data-reveal data-delay="200" className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            选择方案只决定功能和服务等级,实际消耗仍按模型倍率与 token 用量结算。
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-6">
        <Card data-reveal data-delay="200" className="overflow-hidden border-border/80 bg-card/95 shadow-2xl shadow-black/5">
          <CardHeader className="bg-primary/[0.04]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <DatabaseZap className="size-6" />
                </span>
                <div>
                  <CardTitle className="text-xl">选择适合你的用量方案</CardTitle>
                  <CardDescription className="mt-1">
                    免费试用、标准接入、企业保障都共用同一套透明模型价格。
                  </CardDescription>
                </div>
              </div>
              <Badge className="w-fit">
                <Sparkles className="size-3.5" />
                充值即用
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 md:p-6">
            <div className="grid gap-4 lg:grid-cols-3">
              {plans.map((plan, index) => (
                <PlanCard key={plan.name} plan={plan} index={index} />
              ))}
            </div>
          </CardContent>

          <div className="grid gap-3 border-t bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {billingMetrics.map((metric) => (
              <PricingMetric key={metric.label} {...metric} />
            ))}
          </div>
        </Card>
      </section>

      <section id="models" className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <div className="mb-8 text-center">
            <h2 data-reveal className="text-3xl font-semibold md:text-4xl">模型价格表</h2>
            <p data-reveal data-delay="100" className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
              价格以「每百万 token / $」为单位,实际计费按响应体中的 token 消耗计算。
            </p>
          </div>

          <Card data-reveal data-delay="200" className="overflow-hidden">
            <CardHeader className="gap-4 border-b bg-card">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <CardTitle>按模型查看价格</CardTitle>
                  <CardDescription className="mt-1">数据来自后端公开模型接口,只展示当前在线模型。</CardDescription>
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <Badge variant="secondary">{models.length} 个在线模型</Badge>
                  <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索模型 / 厂商"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>模型</TableHead>
                    <TableHead>厂商</TableHead>
                    <TableHead>上下文</TableHead>
                    <TableHead className="text-right">输入 ($/1M)</TableHead>
                    <TableHead className="text-right">输出 ($/1M)</TableHead>
                    <TableHead>分组</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="py-10 text-center text-sm text-muted-foreground">正在加载模型价格</div>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && filtered.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell className="font-mono text-xs">{model.id}</TableCell>
                      <TableCell>{model.vendor}</TableCell>
                      <TableCell className="text-muted-foreground">{formatContext(model.context)}</TableCell>
                      <TableCell className="text-right font-medium">{Number(model.inputPrice).toFixed(3)}</TableCell>
                      <TableCell className="text-right font-medium">{Number(model.outputPrice).toFixed(3)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{formatGroups(model.allowedGroups)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!isLoading && filtered.length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground">没有匹配的模型</div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

function formatContext(context: number): string {
  if (context >= 1_000_000) return `${Number(context / 1_000_000).toFixed(context % 1_000_000 === 0 ? 0 : 1)}M`;
  if (context >= 1_000) return `${Number(context / 1_000).toFixed(context % 1_000 === 0 ? 0 : 1)}K`;
  return context > 0 ? String(context) : "-";
}

function formatGroups(groups: string[]): string {
  return groups.length > 0 ? groups.join(", ") : "默认";
}

type PricingMetricProps = {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "danger";
};

function PricingMetric({ label, value, hint, icon: Icon, tone = "default" }: PricingMetricProps) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : tone === "danger"
          ? "bg-danger/10 text-danger"
          : "bg-primary/10 text-primary";

  return (
    <div className="rounded-lg border bg-background/75 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        </div>
        <span className={cn("grid size-9 place-items-center rounded-lg", toneClass)}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function PlanCard({ plan, index }: { plan: Plan; index: number }) {
  return (
    <div
      data-reveal
      data-delay={String((index + 1) * 100)}
      className={cn(
        "relative flex min-h-[360px] flex-col rounded-lg border bg-background/75 p-5 transition-colors",
        plan.highlight && "border-primary/50 bg-primary/[0.05] shadow-lg shadow-primary/10",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{plan.name}</div>
          <p className="mt-1 min-h-10 text-sm leading-6 text-muted-foreground">{plan.tagline}</p>
        </div>
        {plan.badge && (
          <Badge variant={plan.highlight ? "default" : "secondary"} className="shrink-0">
            {plan.badge}
          </Badge>
        )}
      </div>

      <div className="mt-6 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-normal">{plan.price}</span>
        <span className="text-sm text-muted-foreground">{plan.unit}</span>
      </div>

      <div className="mt-6 h-px bg-border" />

      <ul className="mt-6 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm leading-6">
            <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button asChild className="mt-8" variant={plan.highlight ? "default" : "outline"} size="lg">
        <Link to="/register">
          {plan.cta}
          <ArrowRight className="size-4" />
        </Link>
      </Button>

      {plan.highlight && (
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      )}
    </div>
  );
}
