"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Upload" },
  { href: "/ask", label: "Ask" },
  { href: "/eval", label: "Evaluation" },
] as const;

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-display text-lg font-medium tracking-tight text-ink"
        >
          PDF Evidence
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-6">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={
                  "font-mono text-xs uppercase tracking-wide transition-colors " +
                  (isActive
                    ? "text-primary"
                    : "text-muted hover:text-ink")
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
