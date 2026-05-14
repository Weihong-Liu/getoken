import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

export default function ForgotPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  async function onSendCode(email: string) {
    if (!email) {
      toast.error("请先输入邮箱");
      return;
    }
    try {
      await apiFetch<void>("/auth/send-code", { method: "POST", body: JSON.stringify({ email, scene: "reset" }) });
      toast.success("验证码已发送");
      setCooldown(60);
      const t = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(t); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发送失败");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await apiFetch<void>("/auth/forgot", {
        method: "POST",
        body: JSON.stringify({
          email: String(fd.get("email")),
          code: String(fd.get("code")),
          password: String(fd.get("password")),
        }),
      });
      toast.success("密码已重置,请登录");
      navigate("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "重置失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-semibold">重置密码</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        想起来了?{" "}
        <Link to="/login" className="text-primary hover:underline">返回登录</Link>
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input id="email" name="email" type="email" required placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">验证码</Label>
          <div className="flex gap-2">
            <Input id="code" name="code" required placeholder="6 位数字" />
            <Button
              type="button"
              variant="outline"
              disabled={cooldown > 0}
              onClick={(e) => {
                const input = (e.currentTarget.form?.elements.namedItem("email") as HTMLInputElement | null)?.value ?? "";
                onSendCode(input);
              }}
            >
              {cooldown > 0 ? `${cooldown}s` : "发送"}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">新密码</Label>
          <Input id="password" name="password" type="password" minLength={8} required placeholder="至少 8 位" />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          确认重置
        </Button>
      </form>
    </div>
  );
}
