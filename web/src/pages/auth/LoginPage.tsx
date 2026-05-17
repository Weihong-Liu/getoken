import { useState } from "react";
import useSWR from "swr";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  apiFetch,
  fetcher,
  setToken,
  type PublicSettings,
} from "@/lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const { data: settings } = useSWR<PublicSettings>("/public/settings", fetcher, {
    revalidateOnFocus: false,
  });
  const registrationEnabled = settings?.registrationEnabled === true;
  const githubOAuthEnabled = settings?.githubOAuthEnabled === true;

  async function startGithubOAuth() {
    setGithubLoading(true);
    try {
      const res = await apiFetch<{ url: string }>("/auth/github/start", { method: "POST" });
      window.location.href = res.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "GitHub 登录暂未启用";
      toast.error(msg);
      setGithubLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token);
      toast.success("登录成功");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-semibold">欢迎回来</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {registrationEnabled ? (
          <>
            还没有账号?{" "}
            <Link to="/register" className="text-primary hover:underline">立即注册</Link>
          </>
        ) : (
          <>当前未开放注册，如需账号请联系管理员。</>
        )}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">密码</Label>
            <Link to="/forgot" className="text-xs text-muted-foreground hover:text-foreground">忘记密码?</Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          登录
        </Button>
      </form>

      {githubOAuthEnabled && (
      <>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">或</span>
        </div>
      </div>

      <Button variant="outline" size="lg" className="w-full" disabled={githubLoading} onClick={startGithubOAuth}>
        {githubLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <svg viewBox="0 0 24 24" className="size-4 fill-current"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.3v3.4c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>
        )}
        使用 GitHub 登录
      </Button>
      </>
      )}
    </div>
  );
}
