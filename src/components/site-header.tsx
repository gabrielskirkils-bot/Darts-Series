import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { copy } from "@/lib/copy";
import { getViewer } from "@/lib/supabase/auth";

const navItems = [
  { href: "/", label: copy.nav.ranking },
  { href: "/players", label: copy.nav.players },
  { href: "/tournaments", label: copy.nav.tournaments },
] as const;

const navLink = "rounded-md px-2.5 py-2 text-muted hover:bg-surface-2 hover:text-cream sm:px-3";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
        <Link href="/" className="font-display py-1 text-xl font-bold tracking-wide uppercase">
          <span className="text-board-red" aria-hidden>
            ●
          </span>{" "}
          {copy.appName}
        </Link>
        <nav className="-mx-2 flex flex-wrap items-center text-sm font-medium sm:mx-0">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={navLink}>
              {item.label}
            </Link>
          ))}
          <Suspense fallback={null}>
            <AccountNav />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function AccountNav() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <Link href="/login" className={navLink}>
        {copy.nav.login}
      </Link>
    );
  }
  return (
    <>
      {viewer.isOrganizer ? (
        <Link href="/settings" className={navLink}>
          {copy.nav.settings}
        </Link>
      ) : (
        <Link href="/login" className={`${navLink} text-gold`} title={copy.login.notOrganizer}>
          {copy.nav.readOnly}
        </Link>
      )}
      <form action={signOut}>
        <button type="submit" className={navLink}>
          {copy.nav.logout}
        </button>
      </form>
    </>
  );
}
