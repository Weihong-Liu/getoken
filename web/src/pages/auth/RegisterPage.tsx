import { useState } from "react";
import useSWR from "swr";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, fetcher, setToken, type PublicSettings } from "@/lib/api";

// Extracts the lowercased bare domain (no "@" prefix) from an email.
// Returns "" if the input has no usable domain part.
function emailDomain(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return "";
  const domain = trimmed.slice(at + 1);
  return domain.includes("@") ? "" : domain;
}

// The whitelist on the wire may carry entries in either "domain" or "@domain"
// form depending on how the setting was seeded (DB fixtures use bare; the admin
// settings page writes "@domain"). Strip any leading "@" so the comparison
// works regardless of the source.
function normalizeDomain(s: string): string {
  return s.trim().toLowerCase().replace(/^@+/, "");
}

function isSuffixAllowed(email: string, whitelist: string[]): boolean {
  const list = whitelist.map(normalizeDomain).filter(Boolean);
  if (list.length === 0) return true;
  const domain = emailDomain(email);
  if (!domain) return false;
  return list.includes(domain);
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { data: settings } = useSWR<PublicSettings>("/public/settings", fetcher, {
    revalidateOnFocus: false,
  });
  const settingsReady = Boolean(settings);
  const whitelist = (settings?.emailSuffixWhitelist ?? [])
    .map(normalizeDomain)
    .filter(Boolean);
  const emailVerifyRequired = settings?.emailVerifyRequired ?? true;
  const registrationEnabled = settings?.registrationEnabled === true;

  async function onSendCode(email: string) {
    if (!email) {
      toast.error("请先输入邮箱");
      return;
    }
    if (!isSuffixAllowed(email, whitelist)) {
      toast.error(`邮箱域名不在允许列表内：${whitelist.join(", ")}`);
      return;
    }
    setSending(true);
    try {
      await apiFetch<void>("/auth/send-code", { method: "POST", body: JSON.stringify({ email, purpose: "register" }) });
      toast.success("验证码已发送");
      setCooldown(60);
      const t = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(t);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发送失败");
    } finally {
      setSending(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    const emailCode = String(fd.get("code"));
    const inviteCode = String(fd.get("inviteCode") ?? "");
    if (!isSuffixAllowed(email, whitelist)) {
      toast.error(`邮箱域名不在允许列表内：${whitelist.join(", ")}`);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, emailCode, inviteCode }),
      });
      setToken(res.token);
      toast.success("注册成功,欢迎加入");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-semibold">创建账号</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        已有账号?{" "}
        <Link to="/login" className="text-primary hover:underline">立即登录</Link>
      </p>

      {!registrationEnabled && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          当前未开放注册，请联系管理员开通。
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          {whitelist.length > 0 && (
            <p className="text-xs text-muted-foreground">
              仅允许以下域名注册：{whitelist.join("、")}
            </p>
          )}
        </div>
        {emailVerifyRequired && (
        <div className="space-y-2">
          <Label htmlFor="code">验证码</Label>
          <div className="flex gap-2">
            <Input id="code" name="code" required={emailVerifyRequired} placeholder="6 位数字" />
            <Button
              type="button"
              variant="outline"
              disabled={sending || cooldown > 0}
              onClick={(e) => {
                const input = (e.currentTarget.form?.elements.namedItem("email") as HTMLInputElement | null)?.value ?? "";
                onSendCode(input);
              }}
            >
              {cooldown > 0 ? `${cooldown}s` : sending ? <Loader2 className="size-4 animate-spin" /> : "发送"}
            </Button>
          </div>
        </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="至少 8 位" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inviteCode">邀请码 (可选)</Label>
          <Input id="inviteCode" name="inviteCode" defaultValue={search.get("invite") ?? ""} placeholder="填写邀请码可获得额外额度" />
        </div>
        <p className="text-xs text-muted-foreground">
          点击注册即表示同意{" "}
          <Link to="/terms" className="hover:text-foreground underline underline-offset-2">服务条款</Link>
          {" "}与{" "}
          <Link to="/privacy" className="hover:text-foreground underline underline-offset-2">隐私政策</Link>
        </p>
        <Button type="submit" size="lg" className="w-full" disabled={loading || !settingsReady || !registrationEnabled}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          创建账号
        </Button>
      </form>
    </div>
  );
}
