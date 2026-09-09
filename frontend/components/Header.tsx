"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "올리기" },
  { href: "/ask", label: "질문하기" },
  { href: "/eval", label: "품질 비교" },
] as const;

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-display text-lg font-extrabold tracking-tight text-ink"
        >
          📄 PDF에게
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-2">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={
                  "rounded-full px-3 py-1.5 font-body text-sm font-medium transition-colors " +
                  (isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:bg-line/60 hover:text-ink")
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
