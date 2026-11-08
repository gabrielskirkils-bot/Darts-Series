import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge } from "@/components/status-badge";
import { alertError, btnPrimary } from "@/components/ui";
import { copy } from "@/lib/copy";
import { getViewer } from "@/lib/supabase/auth";
import { listTournaments } from "@/lib/supabase/tournaments";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: copy.tournaments.title };

export default function TournamentsPage() {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl font-bold tracking-wide uppercase">{copy.tournaments.title}</h1>
      <Suspense fallback={<p className="text-muted">{copy.common.loading}</p>}>
        <TournamentList />
      </Suspense>
    </div>
  );
}

async function TournamentList() {
  const data = await Promise.all([listTournaments(), getViewer()]).catch(() => null);
  if (!data) return <p className={alertError}>{copy.common.loadError}</p>;
  const [tournaments, viewer] = data;
  const canEdit = viewer?.isOrganizer ?? false;

  return (
    <div className="space-y-4">
      {canEdit && (
        <Link href="/tournaments/new" className={btnPrimary}>
          + {copy.tournaments.new}
        </Link>
      )}
      {tournaments.length === 0 ? (
        <p className="text-muted">{canEdit ? copy.tournaments.emptyOrganizer : copy.tournaments.empty}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link
                href={`/t/${t.id}`}
                className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface/60"
              >
                <span className="flex flex-col">
                  <span className="text-lg font-semibold">{t.name}</span>
                  <span className="text-sm text-muted">
                    {formatDate(t.date)} · {copy.formatNames[t.format]} · {copy.tournaments.playerCount(t.players)}
                  </span>
                </span>
                <StatusBadge status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
