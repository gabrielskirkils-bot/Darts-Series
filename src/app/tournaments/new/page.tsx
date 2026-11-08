import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { alertError, alertWarn, btnPrimary } from "@/components/ui";
import { copy } from "@/lib/copy";
import { sortPlayers } from "@/lib/domain/players";
import { getViewer } from "@/lib/supabase/auth";
import { getSettings, listPlayers } from "@/lib/supabase/queries";
import { countTournaments } from "@/lib/supabase/tournaments";
import { dateInZone } from "@/lib/time";
import { TournamentWizard } from "./wizard";

export const metadata: Metadata = { title: copy.wizard.title };

export default function NewTournamentPage() {
  return (
    <div className="space-y-5">
      <Link href="/tournaments" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-cream">
        ← {copy.tournament.back}
      </Link>
      <h1 className="font-display text-4xl font-bold tracking-wide uppercase">{copy.wizard.title}</h1>
      <Suspense fallback={<p className="text-muted">{copy.common.loading}</p>}>
        <WizardContent />
      </Suspense>
    </div>
  );
}

async function WizardContent() {
  const viewer = await getViewer();
  if (!viewer?.isOrganizer) {
    return (
      <div className="space-y-3">
        <p className={alertWarn}>{copy.wizard.loginNeeded}</p>
        {!viewer && (
          <Link href="/login?next=/tournaments/new" className={btnPrimary}>
            {copy.nav.login}
          </Link>
        )}
      </div>
    );
  }

  const data = await Promise.all([listPlayers(), getSettings(), countTournaments()]).catch(() => null);
  if (!data) return <p className={alertError}>{copy.common.loadError}</p>;
  const [players, settings, count] = data;

  return (
    <TournamentWizard
      players={sortPlayers(
        players.filter((p) => p.active),
        "name",
      )}
      defaults={{
        name: copy.wizard.defaultName(count + 1),
        date: dateInZone(new Date()),
        formats: settings.fmt,
        boards: settings.boards,
      }}
    />
  );
}
