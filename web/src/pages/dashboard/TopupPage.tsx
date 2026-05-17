import { useState } from "react";
import useSWR from "swr";
import { Gift, Wallet, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { apiFetch, fetcher, type PaymentOrder } from "@/lib/api";
import { cn } from "@/lib/utils";

const presets = [10, 30, 50, 100, 300, 500];

export default function TopupPage() {
  const [amount, setAmount] = useState<number>(50);
  const [channel] = useState<"alipay">("alipay");
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [paying, setPaying] = useState(false);
  const { data: orders = [], mutate: refreshOrders } = useSWR<PaymentOrder[]>("/topup/orders", fetcher, {
    revalidateOnFocus: false,
  });

  async function onRedeem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; // capture before await — React releases synthetic events
    const fd = new FormData(form);
    const code = String(fd.get("code") ?? "").trim();
    if (!code) return;
    setRedeeming(true);
    try {
      const res = await apiFetch<{ balance: number }>("/topup/redeem", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      toast.success(`兑换成功!当前余额 $${Number(res.balance).toFixed(2)}`);
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "兑换失败");
    } finally {
      setRedeeming(false);
    }
  }

  async function onCreateOrder() {
    if (amount < 1) {
      toast.error("最低充值金额为 $1");
      return;
    }
    setPaying(true);
    try {
      const res = await apiFetch<{ order: PaymentOrder; payUrl: string; qrContent: string }>("/topup/order", {
        method: "POST",
        body: JSON.stringify({ amount, channel }),
      });
      setOrder(res.order);
      refreshOrders((current = []) => [res.order, ...current.filter((item) => item.id !== res.order.id)].slice(0, 50), false);
      toast.success("订单已创建");
      if (/^https?:\/\//i.test(res.payUrl)) {
        window.location.href = res.payUrl;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建订单失败");
    } finally {
      setPaying(false);
    }
  }

  async function onSimulatePaid() {
    if (!order) return;
    setPaying(true);
    try {
      const paid = await apiFetch<PaymentOrder>(`/topup/orders/${order.id}/simulate-paid`, { method: "POST" });
      setOrder(paid);
      refreshOrders((current = []) => [paid, ...current.filter((item) => item.id !== paid.id)].slice(0, 50), false);
      toast.success(`支付完成,已入账 $${Number(paid.amount).toFixed(2)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "支付确认失败");
    } finally {
      setPaying(false);
    }
  }

  return (
    <>
      <PageHeader title="充值" description="支持在线支付与卡密兑换,余额永久有效。" />

      <Tabs defaultValue="online" className="space-y-6">
        <TabsList>
          <TabsTrigger value="online"><Wallet className="size-4" />在线充值</TabsTrigger>
          <TabsTrigger value="redeem"><Gift className="size-4" />卡密兑换</TabsTrigger>
        </TabsList>

        <TabsContent value="online">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle>选择金额</CardTitle>
              <CardDescription>充值金额按 1:1 入账,大额充值有额外赠送。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(p)}
                    className={cn(
                      "relative rounded-lg border py-4 text-center transition-all hover:border-primary/40",
                      amount === p ? "border-primary bg-primary/5" : "bg-card",
                    )}
                  >
                    <div className="text-lg font-semibold">${p}</div>
                    {p >= 100 && (
                      <Badge variant="default" className="absolute -top-2 right-1 text-[10px] py-0">+{p === 100 ? 5 : p === 300 ? 20 : 40}</Badge>
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">自定义金额</Label>
                <Input
                  id="amount"
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="text-lg font-semibold"
                />
              </div>

              <div>
                <Label>支付方式</Label>
                <div className="mt-2">
                  <div className="rounded-lg border border-primary bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
                    支付宝
                  </div>
                </div>
              </div>

              <Button onClick={onCreateOrder} size="lg" className="w-full" disabled={paying}>
                {paying && <Loader2 className="size-4 animate-spin" />}
                立即充值 ${amount}
              </Button>
              {order && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">订单 {order.orderNo}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {order.channel} · {order.status} · ${Number(order.amount).toFixed(2)}
                      </div>
                    </div>
                    {order.status === "COMPLETED" ? (
                      <Badge variant="success"><CheckCircle2 className="size-3.5" />已入账</Badge>
                    ) : !import.meta.env.DEV ? (
                      <Badge variant="outline">等待支付宝回调</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={onSimulatePaid} disabled={paying}>
                        {paying && <Loader2 className="size-4 animate-spin" />}
                        开发环境模拟支付
                      </Button>
                    )}
                  </div>
                  <code className="mt-3 block rounded-md bg-background px-3 py-2 text-xs text-muted-foreground">{order.qrContent}</code>
                </div>
              )}
              <p className="text-xs text-muted-foreground text-center">
                * 充值即视为同意服务条款。如有问题请联系客服。
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>支付订单</CardTitle>
              <CardDescription>最近 50 笔支付宝充值记录。</CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  暂无充值订单
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 8).map((item) => (
                    <div key={item.id} className="rounded-lg border bg-card/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.orderNo}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(item.createdAt)} · {item.channel === "alipay" ? "支付宝" : item.channel}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">${Number(item.amount).toFixed(2)}</p>
                          <OrderStatusBadge status={item.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        <TabsContent value="redeem">
          <Card>
            <CardHeader>
              <CardTitle><Sparkles className="inline size-5 mr-1 text-primary" />卡密兑换</CardTitle>
              <CardDescription>输入兑换码,余额将直接计入账户。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onRedeem} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">兑换码</Label>
                  <Input id="code" name="code" required placeholder="XXXX-XXXX-XXXX-XXXX" className="font-mono" />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={redeeming}>
                  {redeeming && <Loader2 className="size-4 animate-spin" />}
                  立即兑换
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function OrderStatusBadge({ status }: { status: PaymentOrder["status"] }) {
  const label =
    status === "COMPLETED" || status === "PAID"
      ? "已支付"
      : status === "PENDING"
        ? "待支付"
        : status === "CANCELLED"
          ? "已取消"
          : status === "EXPIRED"
            ? "已过期"
            : status === "FAILED"
              ? "失败"
              : status;
  const variant = status === "COMPLETED" || status === "PAID" ? "success" : status === "PENDING" ? "outline" : "secondary";
  return <Badge variant={variant}>{label}</Badge>;
}

function formatDate(raw: string) {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
