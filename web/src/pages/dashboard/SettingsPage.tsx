import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

export default function SettingsPage() {
  const { user, refresh, logout } = useAuth();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function onSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSavingProfile(true);
    try {
      await apiFetch("/user/self", { method: "PUT", body: JSON.stringify({ username: String(fd.get("username")) }) });
      toast.success("已保存");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSavingPassword(true);
    try {
      await apiFetch("/user/password", {
        method: "PUT",
        body: JSON.stringify({
          old: String(fd.get("old")),
          new: String(fd.get("new")),
        }),
      });
      toast.success("密码已更新,请重新登录");
      logout();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <>
      <PageHeader title="账户设置" description="管理你的个人资料、安全凭证与通知偏好。" />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">个人资料</TabsTrigger>
          <TabsTrigger value="security">安全</TabsTrigger>
          <TabsTrigger value="notifications">通知</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>个人资料</CardTitle>
              <CardDescription>这些信息只对你自己可见。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSaveProfile} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input id="email" defaultValue={user?.email} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">昵称</Label>
                  <Input id="username" name="username" defaultValue={user?.username} placeholder="未设置" />
                </div>
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile && <Loader2 className="size-4 animate-spin" />}
                  保存修改
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>修改密码</CardTitle>
              <CardDescription>更换密码后会自动退出当前会话。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onChangePassword} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="old">原密码</Label>
                  <Input id="old" name="old" type="password" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new">新密码</Label>
                  <Input id="new" name="new" type="password" minLength={8} required />
                </div>
                <Button type="submit" disabled={savingPassword}>
                  {savingPassword && <Loader2 className="size-4 animate-spin" />}
                  更新密码
                </Button>
              </form>

              <Separator className="my-8" />

              <div className="max-w-md">
                <h3 className="text-sm font-medium">两步验证 (TOTP)</h3>
                <p className="mt-1 text-sm text-muted-foreground">为账户添加二次验证,建议在生产场景下开启。</p>
                <Button variant="outline" className="mt-4" disabled>暂未开启 · 即将上线</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>通知偏好</CardTitle>
              <CardDescription>选择你希望接收的邮件提醒类型。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              {[
                { id: "low_balance", label: "余额不足", desc: "当余额低于 $10 时提醒我" },
                { id: "anomaly", label: "异常调用", desc: "出现持续 5xx 或速率异常时提醒" },
                { id: "weekly", label: "每周报表", desc: "每周一邮件发送上周用量摘要" },
                { id: "product", label: "产品更新", desc: "新模型、新功能与重要变更" },
              ].map((n, i) => (
                <div key={n.id} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                  <div>
                    <Label htmlFor={n.id} className="cursor-pointer">{n.label}</Label>
                    <p className="text-xs text-muted-foreground mt-1">{n.desc}</p>
                  </div>
                  <Switch id={n.id} defaultChecked={i < 2} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
