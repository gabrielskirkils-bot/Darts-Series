import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { copy } from "@/lib/copy";
import { getViewer } from "@/lib/supabase/auth";
import { Crest } from "./crest";
import { NavLinks, NavLinksPlain, navLinkClass } from "./nav-links";

const navItems = [
  { href: "/", label: copy.nav.ranking },
  { href: "/players", label: copy.nav.players },
  { href: "/tournaments", label: copy.nav.tournaments },
] as const;

export function SiteHeader() {
  return (
    <header className="bg-surface/95 shadow-lg shadow-black/25">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
        <Link href="/" className="flex items-center gap-2.5 py-1" aria-label={copy.fullName}>
          <Crest height={44} priority decorative />
          <span className="flex flex-col leading-none">
            <span className="font-display text-2xl tracking-wide uppercase">{copy.appName}</span>
            <span className="mt-0.5 text-[0.7rem] font-semibold tracking-[0.18em] text-muted uppercase">
              {copy.leagueName}
            </span>
          </span>
        </Link>
        <nav className="-mx-2 flex flex-wrap items-center text-sm font-medium sm:mx-0">
          {/* usePathname() is request data: stream it so pages can still prerender. */}
          <Suspense fallback={<NavLinksPlain items={navItems} />}>
            <NavLinks items={navItems} />
          </Suspense>
          <Suspense fallback={null}>
            <AccountNav />
          </Suspense>
        </nav>
      </div>
      <div className="brand-stripe h-1" aria-hidden />
    </header>
  );
}

async function AccountNav() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <Link href="/login" className={navLinkClass}>
        {copy.nav.login}
      </Link>
    );
  }
  return (
    <>
      {viewer.isOrganizer ? (
        <Link href="/settings" className={navLinkClass}>
          {copy.nav.settings}
        </Link>
      ) : (
        <Link href="/login" className={`${navLinkClass} text-gold`} title={copy.login.notOrganizer}>
          {copy.nav.readOnly}
        </Link>
      )}
      <form action={signOut}>
        <button type="submit" className={navLinkClass}>
          {copy.nav.logout}
        </button>
      </form>
    </>
  );
}
