import { useState } from "react";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const [open, setOpen] = useState(false);
  const { theme, toggle, accent, setAccent, accents } = useTheme();
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="切换主题色">
            <Palette />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-64 max-w-[calc(100vw-1rem)] p-2">
          <DropdownMenuLabel className="px-2 pb-2">主题色板</DropdownMenuLabel>
          <div className="grid grid-cols-2 gap-2">
            {accents.map((option) => {
              const active = option.value === accent;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setAccent(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "group rounded-lg border bg-card p-3 text-left transition-all hover:border-primary/40 hover:bg-accent/45",
                    active && "border-primary/50 bg-accent shadow-sm ring-1 ring-primary/20",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className="size-5 rounded-full border border-white/25 shadow-sm ring-2 ring-black/5"
                      style={{ backgroundColor: option.swatch }}
                    />
                    <Check className={cn("size-4 text-primary", active ? "opacity-100" : "opacity-0")} />
                  </span>
                  <span className="mt-3 block text-sm font-medium">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
                  <span className="mt-3 flex gap-1">
                    <span className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: option.swatch }} />
                    <span className="h-1.5 flex-1 rounded-full bg-secondary" />
                    <span className="h-1.5 flex-1 rounded-full bg-muted" />
                  </span>
                </button>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="icon" onClick={toggle} aria-label="切换主题">
        {theme === "dark" ? <Sun /> : <Moon />}
      </Button>
    </div>
  );
}
