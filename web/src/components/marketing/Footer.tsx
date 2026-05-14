import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { site } from "@/lib/site";

const groups = [
  { title: "产品", items: site.footer.product },
  { title: "资源", items: site.footer.resources },
  { title: "公司", items: site.footer.company },
  { title: "法务", items: site.footer.legal },
];

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
              {site.description}
            </p>
          </div>
          {groups.map((g) => (
            <div key={g.title}>
              <h4 className="text-sm font-semibold mb-3">{g.title}</h4>
              <ul className="space-y-2">
                {g.items.map((it) => (
                  <li key={it.href}>
                    {it.href.startsWith("http") ? (
                      <a
                        href={it.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {it.label}
                      </a>
                    ) : (
                      <Link
                        to={it.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {it.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-6 border-t text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {site.name}. All rights reserved.</p>
          <p>
            联系我们: <a href={`mailto:${site.email}`} className="hover:text-foreground">{site.email}</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
