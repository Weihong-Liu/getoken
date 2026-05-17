import { Link, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { LogIn, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 w-full px-3 py-3 transition-all md:px-4"
    >
      <div
        className={cn(
          "mx-auto grid h-14 w-full max-w-[1180px] grid-cols-[1fr_auto] items-center gap-3 rounded-xl border px-3 shadow-2xl shadow-black/10 backdrop-blur-2xl transition-all md:grid-cols-[1fr_auto_1fr] md:px-4",
          "border-border/70 bg-card/88 dark:border-white/10 dark:bg-white/[0.08]",
          scrolled && "shadow-black/20 ring-1 ring-primary/10",
        )}
      >
        <div className="min-w-0">
          <Logo className="max-w-max rounded-lg px-1.5 py-1 transition-colors hover:bg-foreground/[0.04] dark:hover:bg-white/[0.06]" />
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          {site.nav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === "/"}
              className={({ isActive }) => navItemClass(isActive)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-1.5">
          <div className="hidden items-center md:flex [&_button]:size-8 [&_button]:rounded-lg">
            <ThemeToggle />
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden h-9 rounded-lg px-3 text-sm font-medium hover:bg-foreground/[0.04] dark:hover:bg-white/[0.07] md:inline-flex"
          >
            <Link to="/login">
              <LogIn className="size-4" />
              登录
            </Link>
          </Button>
          <Button asChild size="sm" className="hidden h-10 rounded-lg px-4 text-sm font-semibold shadow-lg shadow-primary/15 md:inline-flex">
            <Link to="/register">免费注册</Link>
          </Button>
          <div className="flex items-center md:hidden [&_button]:size-8 [&_button]:rounded-lg">
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="菜单"
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mx-auto mt-2 max-w-[1180px] overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-2xl shadow-black/15 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1 p-2">
            {site.nav.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to="/login">登录</Link>
              </Button>
              <Button asChild size="sm" className="flex-1">
                <Link to="/register">注册</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function navItemClass(active: boolean) {
  return cn(
    "rounded-lg px-4 py-2 text-sm font-medium transition-all",
    active
      ? "bg-primary/12 text-foreground shadow-sm ring-1 ring-primary/15"
      : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground dark:hover:bg-white/[0.07]",
  );
}
