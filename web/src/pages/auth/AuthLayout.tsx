import { Link, Outlet } from "react-router-dom";
import { ThemeToggle } from "@/components/marketing/ThemeToggle";
import { AuthDashboardMap } from "@/components/marketing/AuthDashboardMap";
import { LogoMark } from "@/components/marketing/Logo";

export function AuthLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AuthDashboardMap />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-6 py-4 md:px-10">
          <Link to="/" className="inline-flex items-center gap-2">
            <LogoMark />
            <span className="text-base font-semibold">GeToken</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card/70 p-8 text-card-foreground shadow-2xl shadow-black/20 backdrop-blur-2xl">
            <Outlet />
          </div>
        </div>

        <p className="pb-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} GeToken
        </p>
      </div>
    </div>
  );
}
