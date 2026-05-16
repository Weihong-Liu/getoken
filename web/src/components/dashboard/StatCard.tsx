import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : tone === "danger"
          ? "bg-danger/10 text-danger"
          : "bg-primary/10 text-primary";

  return (
    <Card className="dashboard-panel overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {Icon && (
          <span className={cn("grid place-items-center size-9 rounded-lg shadow-sm", toneClass)}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="mt-4 text-2xl font-semibold tabular-nums tracking-normal">{value}</div>
      {hint && <div className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</div>}
    </Card>
  );
}
