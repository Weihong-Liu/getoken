import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";
export type ThemeAccent = "brand" | "cyan" | "indigo" | "violet" | "rose" | "slate";

const accentOptions: Array<{ value: ThemeAccent; label: string; swatch: string; hint: string }> = [
  { value: "brand", label: "默认绿", swatch: "#6abe39", hint: "推荐" },
  { value: "cyan", label: "极光青", swatch: "#06b6d4", hint: "科技感" },
  { value: "indigo", label: "星际蓝", swatch: "#6366f1", hint: "冷静" },
  { value: "violet", label: "紫晶", swatch: "#8b5cf6", hint: "高亮" },
  { value: "rose", label: "玫瑰", swatch: "#f43f5e", hint: "醒目" },
  { value: "slate", label: "石墨", swatch: "#64748b", hint: "克制" },
];

function getInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("getoken.theme") as Theme | null;
  if (saved) return saved;
  return "dark";
}

function getInitialAccent(): ThemeAccent {
  if (typeof window === "undefined") return "brand";
  const saved = localStorage.getItem("getoken.theme-accent") as ThemeAccent | null;
  return accentOptions.some((option) => option.value === saved) ? (saved as ThemeAccent) : "brand";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitial);
  const [accent, setAccent] = useState<ThemeAccent>(getInitialAccent);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("getoken.theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accent;
    localStorage.setItem("getoken.theme-accent", accent);
  }, [accent]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, setTheme, toggle, accent, setAccent, accents: accentOptions };
}
