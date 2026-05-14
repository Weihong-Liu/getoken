import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, DEMO_LOGIN_EMAIL, DEMO_LOGIN_PASSWORD, setToken } from "@/lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function fillDemoAccount() {
    const form = formRef.current;
    if (!form) return;

    const emailInput = form.elements.namedItem("email") as HTMLInputElement | null;
    const passwordInput = form.elements.namedItem("password") as HTMLInputElement | null;

    if (emailInput) emailInput.value = DEMO_LOGIN_EMAIL;
    if (passwordInput) passwordInput.value = DEMO_LOGIN_PASSWORD;
    toast.success("已填入默认账号");
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
        还没有账号?{" "}
        <Link to="/register" className="text-primary hover:underline">立即注册</Link>
      </p>

      <div className="mt-6 rounded-lg border bg-card/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">默认演示账号</p>
            <p className="mt-1 text-xs text-muted-foreground">本地没有后端时,也可以直接用这组账号进入控制台。</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={fillDemoAccount}>
            <Copy className="size-4" />
            填入
          </Button>
        </div>
        <div className="mt-3 space-y-2 rounded-md bg-muted/35 p-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">邮箱</span>
            <code className="text-xs">{DEMO_LOGIN_EMAIL}</code>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">密码</span>
            <code className="text-xs">{DEMO_LOGIN_PASSWORD}</code>
          </div>
        </div>
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="mt-8 space-y-4">
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

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">或</span>
        </div>
      </div>

      <Button variant="outline" size="lg" className="w-full" disabled>
        <svg viewBox="0 0 24 24" className="size-4 fill-current"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.3v3.4c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>
        使用 GitHub 登录(待接入)
      </Button>
    </div>
  );
}
