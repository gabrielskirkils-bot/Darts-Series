import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { copy } from "@/lib/copy";
import "./globals.css";

const body = Barlow({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const condensed = Barlow_Condensed({
  variable: "--font-condensed",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: copy.appName, template: `%s · ${copy.appName}` },
  description: copy.tagline,
};

export const viewport: Viewport = {
  themeColor: "#0c1410",
  width: "device-width",
  initialScale: 1,
};

const navItems = [
  { href: "/", label: copy.nav.ranking },
  { href: "/players", label: copy.nav.players },
  { href: "/tournaments", label: copy.nav.tournaments },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${condensed.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
            <Link href="/" className="font-display text-xl font-bold tracking-wide uppercase">
              <span className="text-board-red">●</span> {copy.appName}
            </Link>
            <nav className="flex gap-1 text-sm font-medium">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-muted hover:bg-surface-2 hover:text-cream"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
