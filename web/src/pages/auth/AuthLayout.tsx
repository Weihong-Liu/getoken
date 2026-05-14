import { Link, Outlet } from "react-router-dom";
import { ThemeToggle } from "@/components/marketing/ThemeToggle";
import { AuthDashboardMap } from "@/components/marketing/AuthDashboardMap";

export function AuthLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AuthDashboardMap />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-6 py-4 md:px-10">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg border border-border bg-card/60 backdrop-blur">
              <svg
                viewBox="0 0 32 32"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M10 12h12M10 16h12M10 20h8" />
              </svg>
            </span>
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
