import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StatusBadge } from "@/components/status-badge";
import { alertError, btnSecondary } from "@/components/ui";
import { copy, formatSummary } from "@/lib/copy";
import { roundNameFromEnd } from "@/lib/domain/bracket";
import { tournamentOverview } from "@/lib/domain/tournament";
import { getViewer } from "@/lib/supabase/auth";
import { getTournament } from "@/lib/supabase/tournaments";
import { formatDate } from "@/lib/time";
import { LiveRefresh } from "./live-refresh";
import { TournamentActions } from "./tournament-actions";
import { TournamentTabs } from "./tournament-tabs";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default function TournamentPage({ params }: PageProps<"/t/[id]">) {
  return (
    <div className="space-y-5">
      <Link href="/tournaments" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-cream">
        ← {copy.tournament.back}
      </Link>
      <Suspense fallback={<p className="text-muted">{copy.common.loading}</p>}>
        <TournamentContent params={params} />
      </Suspense>
    </div>
  );
}

async function TournamentContent({ params }: { params: PageProps<"/t/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const data = await Promise.all([getTournament(id), getViewer()]).catch(() => null);
  if (!data) return <p className={alertError}>{copy.common.loadError}</p>;
  const [t, viewer] = data;
  if (!t) notFound();
  const canEdit = viewer?.isOrganizer ?? false;

  const overview = tournamentOverview(t);
  const summary = formatSummary({
    format: t.format,
    groupCount: t.groupCount,
    advance: t.advance,
    rounds: overview.rounds,
    firstRound: overview.rounds ? roundNameFromEnd(overview.rounds) : null,
    fmt: t.fmt,
  });
  const names = Object.fromEntries(t.entrants.map((e) => [e.playerId, e.name]));
  const { done, total } = overview.progress;
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <LiveRefresh tournamentId={t.id} />

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-display text-4xl font-bold tracking-wide uppercase">{t.name}</h1>
          <StatusBadge status={t.status} />
        </div>
        <p className="text-muted">
          {formatDate(t.date)} · {copy.tournaments.playerCount(t.entrants.length)}
        </p>
        <p className="text-sm">{summary}</p>
        <div className="space-y-1 sm:max-w-md">
          <div className="flex justify-between text-sm text-muted">
            <span id="progress-label">{copy.tournament.progressLabel}</span>
            <span className="num">{copy.tournament.progress(done, total)}</span>
          </div>
          <div
            role="progressbar"
            aria-labelledby="progress-label"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            className="h-2.5 overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full rounded-full bg-board-green" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label={copy.tournament.boards}>
        {canEdit &&
          t.status !== "done" &&
          Array.from({ length: t.boards }, (_, i) => (
            <Link key={i} href={`/t/${t.id}/board/${i + 1}`} className={btnSecondary}>
              {copy.tournament.board(i + 1)}
            </Link>
          ))}
        <Link href={`/t/${t.id}/tv`} className={btnSecondary}>
          {copy.tournament.tv}
        </Link>
      </nav>

      {canEdit && (
        <TournamentActions
          tournamentId={t.id}
          canRedraw={overview.canRedraw}
          canStartKnockout={overview.canStartKnockout}
          seeding={t.seeding}
        />
      )}

      <TournamentTabs
        tournamentId={t.id}
        format={t.format}
        status={t.status}
        overview={overview}
        names={names}
        canEdit={canEdit}
      />
    </div>
  );
}
