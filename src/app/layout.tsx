import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
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

// Headings echo the crest's slanted "SAL": only the heavy italic is needed.
const heading = Barlow_Condensed({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext"],
  weight: "800",
  style: "italic",
});

export const metadata: Metadata = {
  title: { default: copy.fullName, template: `%s · ${copy.appName}` },
  description: copy.tagline,
  applicationName: copy.fullName,
  appleWebApp: { title: copy.appName, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#081530",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${condensed.variable} ${heading.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
