import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";
export type ThemeAccent = "brand" | "cyan" | "indigo" | "violet" | "rose" | "slate";

const themeAccentKey = "getoken.theme-accent";
const manualAccentKey = "getoken.theme-accent-manual";

const accentOptions: Array<{ value: ThemeAccent; label: string; swatch: string; hint: string }> = [
  { value: "rose", label: "玫瑰", swatch: "#f43f5e", hint: "默认" },
  { value: "brand", label: "青绿", swatch: "#6abe39", hint: "经典" },
  { value: "cyan", label: "极光青", swatch: "#06b6d4", hint: "科技感" },
  { value: "indigo", label: "星际蓝", swatch: "#6366f1", hint: "冷静" },
  { value: "violet", label: "紫晶", swatch: "#8b5cf6", hint: "高亮" },
  { value: "slate", label: "石墨", swatch: "#64748b", hint: "克制" },
];

function getInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("getoken.theme") as Theme | null;
  if (saved) return saved;
  return "dark";
}

function getInitialAccent(): ThemeAccent {
  if (typeof window === "undefined") return "rose";
  const saved = localStorage.getItem(themeAccentKey) as ThemeAccent | null;
  const manual = localStorage.getItem(manualAccentKey) === "true";
  const valid = accentOptions.some((option) => option.value === saved);
  if (!valid) return "rose";
  if (saved === "brand" && !manual) return "rose";
  return saved as ThemeAccent;
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
    localStorage.setItem(themeAccentKey, accent);
  }, [accent]);

  const setThemeAccent = useCallback((next: ThemeAccent) => {
    localStorage.setItem(manualAccentKey, "true");
    setAccent(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, setTheme, toggle, accent, setAccent: setThemeAccent, accents: accentOptions };
}
