import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("inline-flex items-center gap-2 group", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand-300 via-brand-500 to-emerald-400 text-neutral-950 shadow-sm">
        <svg viewBox="0 0 32 32" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M10 12h12M10 16h12M10 20h8" />
        </svg>
      </span>
      <span className="text-base font-semibold">GeToken</span>
    </Link>
  );
}
