import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/dashboard/PageHeader";

export default function SystemSettingsPage() {
  const [saving, setSaving] = useState<string | null>(null);

  function save(section: string) {
    setSaving(section);
    setTimeout(() => {
      setSaving(null);
      toast.success(`${section} 设置已保存`);
    }, 600);
  }

  return (
    <>
      <PageHeader title="系统设置" description="站点信息、邮件、支付、安全等全局配置。" />

      <Tabs defaultValue="site" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="site">站点</TabsTrigger>
          <TabsTrigger value="email">邮件</TabsTrigger>
          <TabsTrigger value="payment">支付</TabsTrigger>
          <TabsTrigger value="security">安全</TabsTrigger>
          <TabsTrigger value="invite">邀请返利</TabsTrigger>
        </TabsList>

        <TabsContent value="site">
          <Card>
            <CardHeader>
              <CardTitle>站点信息</CardTitle>
              <CardDescription>展示在首页、邮件签名等位置。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="space-y-2">
                <Label>站点名称</Label>
                <Input defaultValue="GeToken" />
              </div>
              <div className="space-y-2">
                <Label>站点标语</Label>
                <Input defaultValue="高速聚合中转站" />
              </div>
              <div className="space-y-2">
                <Label>客服邮箱</Label>
                <Input defaultValue="support@getoken.cc" />
              </div>
              <div className="space-y-2">
                <Label>备案号</Label>
                <Input placeholder="可选" />
              </div>
              <Button onClick={() => save("站点")} disabled={saving === "站点"}>
                {saving === "站点" && <Loader2 className="size-4 animate-spin" />}保存
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>邮件 (SMTP)</CardTitle>
              <CardDescription>用于发送验证码、通知与告警邮件。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>SMTP 主机</Label>
                  <Input placeholder="smtp.example.com" />
                </div>
                <div className="space-y-2">
                  <Label>端口</Label>
                  <Input type="number" defaultValue={465} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>账号</Label>
                <Input placeholder="noreply@getoken.cc" />
              </div>
              <div className="space-y-2">
                <Label>密码 / 授权码</Label>
                <Input type="password" />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>启用 SSL/TLS</Label>
                <Switch defaultChecked />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => save("邮件")} disabled={saving === "邮件"}>
                  {saving === "邮件" && <Loader2 className="size-4 animate-spin" />}保存
                </Button>
                <Button variant="outline">发送测试邮件</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <CardTitle>支付渠道</CardTitle>
              <CardDescription>配置在线充值的支付方式。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-xl">
              {[
                { id: "alipay", label: "支付宝(易支付)" },
                { id: "wxpay", label: "微信支付" },
                { id: "usdt", label: "USDT (TRC20)" },
              ].map((p) => (
                <div key={p.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">{p.label}</h3>
                    <Switch />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="商户号 / 接收地址" />
                    <Input type="password" placeholder="密钥" />
                  </div>
                </div>
              ))}
              <Button onClick={() => save("支付")} disabled={saving === "支付"}>
                {saving === "支付" && <Loader2 className="size-4 animate-spin" />}保存
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>安全与限流</CardTitle>
              <CardDescription>注册风控、限流、Turnstile 等。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>开放注册</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">关闭后需要邀请码才能注册</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>必须邮箱验证</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">注册时强制发送验证码</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="space-y-2">
                <Label>Turnstile Site Key</Label>
                <Input placeholder="可选" />
              </div>
              <div className="space-y-2">
                <Label>单 IP 注册限制 (次/天)</Label>
                <Input type="number" defaultValue={5} />
              </div>
              <Button onClick={() => save("安全")} disabled={saving === "安全"}>
                {saving === "安全" && <Loader2 className="size-4 animate-spin" />}保存
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invite">
          <Card>
            <CardHeader>
              <CardTitle>邀请返利</CardTitle>
              <CardDescription>设置返利比例与赠送额度。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="space-y-2">
                <Label>返利比例 (%)</Label>
                <Input type="number" defaultValue={5} step={0.5} />
              </div>
              <div className="space-y-2">
                <Label>新用户注册赠送 (¥)</Label>
                <Input type="number" defaultValue={1} step={0.1} />
              </div>
              <div className="space-y-2">
                <Label>通过邀请码注册额外赠送 (¥)</Label>
                <Input type="number" defaultValue={2} step={0.1} />
              </div>
              <Button onClick={() => save("邀请返利")} disabled={saving === "邀请返利"}>
                {saving === "邀请返利" && <Loader2 className="size-4 animate-spin" />}保存
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
