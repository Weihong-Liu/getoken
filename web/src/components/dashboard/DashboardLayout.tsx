import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  KeyRound,
  ScrollText,
  Wallet,
  Users2,
  Settings,
  Menu,
  X,
  Shield,
  Server,
  Cpu,
  Tag,
  Gift,
  Receipt,
  Megaphone,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Logo } from "@/components/marketing/Logo";
import { ThemeToggle } from "@/components/marketing/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type NavItem = { label: string; to: string; icon: typeof LayoutDashboard };

const userNav: NavItem[] = [
  { label: "总览", to: "/dashboard", icon: LayoutDashboard },
  { label: "API Keys", to: "/dashboard/tokens", icon: KeyRound },
  { label: "调用日志", to: "/dashboard/logs", icon: ScrollText },
  { label: "充值", to: "/dashboard/topup", icon: Wallet },
  { label: "邀请返利", to: "/dashboard/referral", icon: Users2 },
  { label: "账户设置", to: "/dashboard/settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { label: "总览", to: "/admin", icon: LayoutDashboard },
  { label: "用户管理", to: "/admin/users", icon: Users2 },
  { label: "渠道管理", to: "/admin/channels", icon: Server },
  { label: "模型管理", to: "/admin/models", icon: Cpu },
  { label: "分组管理", to: "/admin/groups", icon: Tag },
  { label: "调用日志", to: "/admin/logs", icon: ScrollText },
  { label: "卡密管理", to: "/admin/redemption", icon: Gift },
  { label: "订单管理", to: "/admin/orders", icon: Receipt },
  { label: "公告管理", to: "/admin/announcements", icon: Megaphone },
  { label: "系统设置", to: "/admin/settings", icon: Settings },
];

export function DashboardLayout({ variant = "user" }: { variant?: "user" | "admin" }) {
  const nav = variant === "admin" ? adminNav : userNav;
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-muted/20">
      <Sidebar nav={nav} collapsed={collapsed} variant={variant} onClose={() => setOpen(false)} mobileOpen={open} />

      <div
        className={cn(
          "flex flex-col min-h-screen transition-[padding] duration-200",
          collapsed ? "lg:pl-[68px]" : "lg:pl-60",
        )}
      >
        <header className="sticky top-0 z-30 h-14 border-b bg-background/80 backdrop-blur">
          <div className="h-full px-4 md:px-6 flex items-center justify-between gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((v) => !v)}>
              {open ? <X /> : <Menu />}
            </Button>
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={() => setCollapsed((v) => !v)}>
              {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
            </Button>

            <div className="hidden md:flex flex-1 items-center gap-3 text-sm text-muted-foreground">
              {variant === "admin" && <span className="inline-flex items-center gap-1 text-warning"><Shield className="size-3.5" /> 管理后台</span>}
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && variant === "user" && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin"><Shield className="size-4" />管理后台</Link>
                </Button>
              )}
              {variant === "admin" && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/dashboard">返回控制台</Link>
                </Button>
              )}
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
                    <Avatar>
                      <AvatarFallback>{user?.email?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{user?.email ?? "未登录"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/settings"><Settings /> 账户设置</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={logout} className="text-danger focus:text-danger">
                    <LogOut /> 退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  nav,
  collapsed,
  mobileOpen,
  onClose,
  variant,
}: {
  nav: NavItem[];
  collapsed: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  variant: "user" | "admin";
}) {
  return (
    <>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-card border-r transition-all",
          "w-60",
          collapsed && "lg:w-[68px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        )}
      >
        <div className={cn("h-14 flex items-center border-b px-4", collapsed && "lg:px-3 lg:justify-center")}>
          {collapsed ? (
            <Link to="/" className="grid place-items-center size-8 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <svg viewBox="0 0 32 32" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M10 12h12M10 16h12M10 20h8" />
              </svg>
            </Link>
          ) : (
            <Logo />
          )}
        </div>
        <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {nav.map((item) => (
            <NavItemRow key={item.to} item={item} collapsed={collapsed} onNavigate={onClose} variant={variant} />
          ))}
        </nav>
        {!collapsed && (
          <div className="border-t p-4">
            <p className="text-xs text-muted-foreground">
              {variant === "admin" ? "管理员模式" : "需要帮助?"}
            </p>
            {variant !== "admin" && (
              <a
                href="https://docs.getoken.cc"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-sm text-primary hover:underline"
              >
                查看使用文档 →
              </a>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

function NavItemRow({
  item,
  collapsed,
  onNavigate,
  variant,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate: () => void;
  variant: "user" | "admin";
}) {
  const location = useLocation();
  const Icon = item.icon;
  // Match exact for /dashboard and /admin root
  const isRoot = item.to === "/dashboard" || item.to === "/admin";
  const active = isRoot ? location.pathname === item.to : location.pathname.startsWith(item.to);

  const content = (
    <NavLink
      to={item.to}
      end={isRoot}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
        collapsed && "lg:justify-center lg:px-2",
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="size-4 shrink-0" />
      <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
    </NavLink>
  );

  // suppress unused variant lint
  void variant;

  return content as ReactNode;
}
