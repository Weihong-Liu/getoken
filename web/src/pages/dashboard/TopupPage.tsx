import { useState } from "react";
import { Gift, Wallet, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const presets = [10, 30, 50, 100, 300, 500];

export default function TopupPage() {
  const [amount, setAmount] = useState<number>(50);
  const [channel, setChannel] = useState<"alipay" | "wxpay" | "usdt">("alipay");
  const [redeeming, setRedeeming] = useState(false);
  const [paying, setPaying] = useState(false);

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
      const res = await apiFetch<{ payUrl: string }>("/topup/order", {
        method: "POST",
        body: JSON.stringify({ amount, channel }),
      });
      window.location.href = res.payUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建订单失败");
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
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { id: "alipay", label: "支付宝", color: "text-[#1677ff]" },
                    { id: "wxpay", label: "微信", color: "text-[#07c160]" },
                    { id: "usdt", label: "USDT", color: "text-[#26a17b]" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChannel(c.id as typeof channel)}
                      className={cn(
                        "rounded-lg border py-3 text-sm font-medium transition-all hover:border-primary/40",
                        channel === c.id ? "border-primary bg-primary/5" : "bg-card",
                        c.color,
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={onCreateOrder} size="lg" className="w-full" disabled={paying}>
                {paying && <Loader2 className="size-4 animate-spin" />}
                立即充值 ${amount}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                * 充值即视为同意服务条款。如有问题请联系客服。
              </p>
            </CardContent>
          </Card>
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
