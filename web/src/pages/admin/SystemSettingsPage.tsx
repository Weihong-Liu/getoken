import { useState } from "react";
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { apiFetch, fetcher, type AdminSettings } from "@/lib/api";
import { demoAdminSettings } from "@/lib/mock";

function asString(v: unknown, fallback = ""): string {
  if (v === undefined || v === null) return fallback;
  return String(v);
}

function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1" || v === 1) return true;
  if (v === "false" || v === "0" || v === 0) return false;
  return fallback;
}

function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string" && v.trim() !== "") return [v];
  return [];
}

// Parses the textarea (one suffix per line or comma-separated) into a clean
// "@domain" list. Empty / malformed entries are dropped; backend re-validates.
function parseSuffixList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    let s = part.trim().toLowerCase();
    if (!s) continue;
    if (!s.startsWith("@")) s = "@" + s.replace(/^@+/, "");
    const domain = s.slice(1);
    if (!domain.includes(".")) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export default function SystemSettingsPage() {
  const { data, mutate } = useSWR<AdminSettings>("/admin/settings", fetcher, {
    fallbackData: demoAdminSettings,
    revalidateOnFocus: false,
  });
  const settings = data ?? {};
  const [saving, setSaving] = useState<string | null>(null);

  async function saveSection(section: string, patch: Record<string, unknown>) {
    setSaving(section);
    try {
      await apiFetch("/admin/settings", { method: "PUT", body: JSON.stringify(patch) });
      toast.success(`${section} 设置已保存`);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(null);
    }
  }

  async function onSubmitSite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await saveSection("站点", {
      "site.title": String(fd.get("siteTitle") || ""),
      "site.slogan": String(fd.get("siteSlogan") || ""),
      "site.supportEmail": String(fd.get("supportEmail") || ""),
      "site.icp": String(fd.get("icp") || ""),
    });
  }

  async function onSubmitEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const patch: Record<string, unknown> = {
      "smtp.host": String(fd.get("smtpHost") || ""),
      "smtp.port": Number(fd.get("smtpPort") || 465),
      "smtp.user": String(fd.get("smtpUser") || ""),
      "smtp.tls": fd.get("smtpTls") === "on",
    };
    const password = String(fd.get("smtpPassword") || "");
    if (password) patch["smtp.password"] = password;
    await saveSection("邮件", patch);
  }

  async function onSubmitPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const patch: Record<string, unknown> = {};
    for (const id of ["alipay", "wxpay", "usdt"]) {
      patch[`payment.${id}.enabled`] = fd.get(`${id}-enabled`) === "on";
      patch[`payment.${id}.account`] = String(fd.get(`${id}-account`) || "");
      const secret = String(fd.get(`${id}-secret`) || "");
      if (secret) patch[`payment.${id}.secret`] = secret;
    }
    await saveSection("支付", patch);
  }

  async function onSubmitSecurity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const whitelistRaw = String(fd.get("emailSuffixWhitelist") || "");
    await saveSection("安全", {
      "register.enabled": fd.get("registerEnabled") === "on",
      "register.requireEmail": fd.get("requireEmail") === "on",
      "register.emailSuffixWhitelist": parseSuffixList(whitelistRaw),
      "turnstile.siteKey": String(fd.get("turnstileKey") || ""),
      "register.ipDailyLimit": Number(fd.get("ipLimit") || 0),
    });
  }

  async function onSubmitInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await saveSection("邀请返利", {
      "invite.rewardPercent": Number(fd.get("rewardPercent") || 0),
      "invite.signupBonus": String(fd.get("signupBonus") || "0"),
      "invite.refereeBonus": String(fd.get("refereeBonus") || "0"),
    });
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
            <CardContent>
              <form onSubmit={onSubmitSite} className="space-y-4 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="siteTitle">站点名称</Label>
                  <Input id="siteTitle" name="siteTitle" defaultValue={asString(settings["site.title"], "GeToken")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteSlogan">站点标语</Label>
                  <Input id="siteSlogan" name="siteSlogan" defaultValue={asString(settings["site.slogan"])} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supportEmail">客服邮箱</Label>
                  <Input id="supportEmail" name="supportEmail" type="email" defaultValue={asString(settings["site.supportEmail"])} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icp">备案号</Label>
                  <Input id="icp" name="icp" placeholder="可选" defaultValue={asString(settings["site.icp"])} />
                </div>
                <Button type="submit" disabled={saving === "站点"}>
                  {saving === "站点" && <Loader2 className="size-4 animate-spin" />}保存
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>邮件 (SMTP)</CardTitle>
              <CardDescription>用于发送验证码、通知与告警邮件。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmitEmail} className="space-y-4 max-w-xl">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="smtpHost">SMTP 主机</Label>
                    <Input id="smtpHost" name="smtpHost" defaultValue={asString(settings["smtp.host"])} placeholder="smtp.example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpPort">端口</Label>
                    <Input id="smtpPort" name="smtpPort" type="number" defaultValue={asNumber(settings["smtp.port"], 465)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpUser">账号</Label>
                  <Input id="smtpUser" name="smtpUser" defaultValue={asString(settings["smtp.user"])} placeholder="noreply@getoken.cc" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">密码 / 授权码 (留空不修改)</Label>
                  <Input id="smtpPassword" name="smtpPassword" type="password" />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="smtpTls">启用 SSL/TLS</Label>
                  <Switch id="smtpTls" name="smtpTls" defaultChecked={asBool(settings["smtp.tls"], true)} />
                </div>
                <Button type="submit" disabled={saving === "邮件"}>
                  {saving === "邮件" && <Loader2 className="size-4 animate-spin" />}保存
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <CardTitle>支付渠道</CardTitle>
              <CardDescription>配置在线充值的支付方式。密钥留空表示不修改。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmitPayment} className="space-y-6 max-w-xl">
                {[
                  { id: "alipay", label: "支付宝(易支付)" },
                  { id: "wxpay", label: "微信支付" },
                  { id: "usdt", label: "USDT (TRC20)" },
                ].map((p) => (
                  <div key={p.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">{p.label}</h3>
                      <Switch name={`${p.id}-enabled`} defaultChecked={asBool(settings[`payment.${p.id}.enabled`])} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input name={`${p.id}-account`} placeholder="商户号 / 接收地址" defaultValue={asString(settings[`payment.${p.id}.account`])} />
                      <Input name={`${p.id}-secret`} type="password" placeholder="密钥 (留空不修改)" />
                    </div>
                  </div>
                ))}
                <Button type="submit" disabled={saving === "支付"}>
                  {saving === "支付" && <Loader2 className="size-4 animate-spin" />}保存
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>安全与限流</CardTitle>
              <CardDescription>注册风控、限流、Turnstile 等。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmitSecurity} className="space-y-4 max-w-xl">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="registerEnabled">开启验证码注册</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      关闭后公共注册接口直接拒绝，新用户只能由 admin 在「用户管理」手动添加
                    </p>
                  </div>
                  <Switch id="registerEnabled" name="registerEnabled" defaultChecked={asBool(settings["register.enabled"], true)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="requireEmail">注册时必须邮箱验证码</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      启用后注册强制发送邮件验证码 (依赖 MAIL_PROVIDER；当前 Resend 已激活)；关闭则只要密码合法就能直接注册，仅在 admin 信得过受众时考虑
                    </p>
                  </div>
                  <Switch id="requireEmail" name="requireEmail" defaultChecked={asBool(settings["register.requireEmail"], true)} />
                </div>
                <div className="rounded-lg border p-3 bg-muted/40">
                  <Label>找回密码</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    已自动启用 — 用户在登录页点「忘记密码」走邮件 6 位码重置流程，未注册的邮箱也会返回相同响应（防枚举）
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailSuffixWhitelist">邮箱域名白名单</Label>
                  <textarea
                    id="emailSuffixWhitelist"
                    name="emailSuffixWhitelist"
                    rows={3}
                    className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="@qq.com  @gmail.com（留空 = 不限制）"
                    defaultValue={asStringList(settings["register.emailSuffixWhitelist"]).join("\n")}
                  />
                  <p className="text-xs text-muted-foreground">每行一个，自动补 @ 前缀。留空允许所有域名。</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="turnstileKey">Turnstile Site Key</Label>
                  <Input id="turnstileKey" name="turnstileKey" placeholder="可选" defaultValue={asString(settings["turnstile.siteKey"])} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ipLimit">单 IP 注册限制 (次/天)</Label>
                  <Input id="ipLimit" name="ipLimit" type="number" defaultValue={asNumber(settings["register.ipDailyLimit"], 5)} />
                </div>
                <Button type="submit" disabled={saving === "安全"}>
                  {saving === "安全" && <Loader2 className="size-4 animate-spin" />}保存
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invite">
          <Card>
            <CardHeader>
              <CardTitle>邀请返利</CardTitle>
              <CardDescription>设置返利比例与赠送额度。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmitInvite} className="space-y-4 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="rewardPercent">返利比例 (%)</Label>
                  <Input id="rewardPercent" name="rewardPercent" type="number" step={0.5} defaultValue={asNumber(settings["invite.rewardPercent"], 5)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signupBonus">新用户注册赠送 ($)</Label>
                  <Input id="signupBonus" name="signupBonus" type="number" step={0.1} defaultValue={asString(settings["invite.signupBonus"], "1")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refereeBonus">通过邀请码注册额外赠送 ($)</Label>
                  <Input id="refereeBonus" name="refereeBonus" type="number" step={0.1} defaultValue={asString(settings["invite.refereeBonus"], "2")} />
                </div>
                <Button type="submit" disabled={saving === "邀请返利"}>
                  {saving === "邀请返利" && <Loader2 className="size-4 animate-spin" />}保存
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
