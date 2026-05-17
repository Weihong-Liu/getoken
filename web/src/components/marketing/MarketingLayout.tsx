import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { useReveal } from "@/hooks/useReveal";

export function MarketingLayout() {
  useReveal();
  const location = useLocation();

  useEffect(() => {
    window.history.scrollRestoration = "manual";
  }, []);

  useEffect(() => {
    if (location.hash) return;

    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.key, location.pathname]);

  useEffect(() => {
    if (!location.hash) return;

    const id = decodeURIComponent(location.hash.slice(1));
    let frame = 0;
    const timers: number[] = [];
    let attempts = 0;

    const scrollToHash = (behavior: ScrollBehavior = "smooth") => {
      const target = document.getElementById(id);
      if (target) {
        const headerOffset = 96;
        const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({ top: Math.max(0, top), behavior });
      } else {
        attempts += 1;
        if (attempts < 12) {
          frame = window.requestAnimationFrame(() => scrollToHash(behavior));
        }
      }
    };

    frame = window.requestAnimationFrame(() => scrollToHash("smooth"));
    timers.push(window.setTimeout(() => scrollToHash("auto"), 240));
    timers.push(window.setTimeout(() => scrollToHash("auto"), 700));

    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [location.hash, location.key, location.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-20">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
