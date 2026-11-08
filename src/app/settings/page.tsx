import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { alertError, alertWarn, btnPrimary } from "@/components/ui";
import { copy } from "@/lib/copy";
import { getViewer } from "@/lib/supabase/auth";
import { getSettings } from "@/lib/supabase/queries";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: copy.settings.title };

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl font-bold tracking-wide uppercase">{copy.settings.title}</h1>
      <Suspense fallback={<p className="text-muted">{copy.common.loading}</p>}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  const viewer = await getViewer();
  if (!viewer?.isOrganizer) {
    return (
      <div className="space-y-3">
        <p className={alertWarn}>{copy.settings.loginNeeded}</p>
        {!viewer && (
          <Link href="/login?next=/settings" className={btnPrimary}>
            {copy.nav.login}
          </Link>
        )}
      </div>
    );
  }
  const settings = await getSettings().catch(() => null);
  if (!settings) return <p className={alertError}>{copy.common.loadError}</p>;
  return <SettingsForm initial={settings} />;
}
