"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const navLinkClass =
  "rounded-md px-2.5 py-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink sm:px-3";

/** The same links without the current-page mark (Suspense fallback while the URL streams in). */
export function NavLinksPlain({ items }: { items: readonly { href: string; label: string }[] }) {
  return (
    <>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={navLinkClass}>
          {item.label}
        </Link>
      ))}
    </>
  );
}

/** Main navigation; the current section is marked (gold underline + aria-current). */
export function NavLinks({ items }: { items: readonly { href: string; label: string }[] }) {
  const path = usePathname();
  const isCurrent = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`) || (href === "/tournaments" && path.startsWith("/t/"));
  return (
    <>
      {items.map((item) => {
        const current = isCurrent(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`${navLinkClass} ${current ? "text-ink underline decoration-gold decoration-2 underline-offset-8" : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
