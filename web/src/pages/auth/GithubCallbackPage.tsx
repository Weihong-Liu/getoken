import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, setToken } from "@/lib/api";

export default function GithubCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  // Strict-mode double-mount guard so we don't POST the same code twice.
  const exchangedRef = useRef(false);

  useEffect(() => {
    if (exchangedRef.current) return;
    exchangedRef.current = true;
    const code = params.get("code");
    const state = params.get("state");
    const oauthErr = params.get("error");
    if (oauthErr) {
      const desc = params.get("error_description") || oauthErr;
      setError(desc);
      toast.error(`GitHub 授权失败: ${desc}`);
      return;
    }
    if (!code || !state) {
      setError("缺少 code 或 state 参数");
      return;
    }
    apiFetch<{ token: string }>("/auth/github/callback", {
      method: "POST",
      body: JSON.stringify({ code, state }),
    })
      .then((res) => {
        setToken(res.token);
        toast.success("登录成功");
        navigate("/dashboard", { replace: true });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "GitHub 登录失败";
        setError(msg);
        toast.error(msg);
      });
  }, [params, navigate]);

  return (
    <div className="animate-fade-up text-center">
      {error ? (
        <>
          <h1 className="text-2xl font-semibold text-destructive">登录失败</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            className="mt-6 text-sm text-primary hover:underline"
            onClick={() => navigate("/login", { replace: true })}
          >
            返回登录
          </button>
        </>
      ) : (
        <>
          <Loader2 className="mx-auto size-8 animate-spin text-primary" />
          <h1 className="mt-4 text-xl font-semibold">正在完成 GitHub 登录…</h1>
          <p className="mt-2 text-sm text-muted-foreground">请稍候，跳转中…</p>
        </>
      )}
    </div>
  );
}
