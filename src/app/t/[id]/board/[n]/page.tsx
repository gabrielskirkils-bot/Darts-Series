import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Scoreboard } from "@/components/scoreboard/scoreboard";
import { alertError, alertWarn, btnPrimary } from "@/components/ui";
import { copy, matchLabel } from "@/lib/copy";
import { busyPlayers, isPlayable, liveOnBoard, nextMatch, waitingMatches } from "@/lib/domain/queue";
import { getViewer } from "@/lib/supabase/auth";
import { getSettings } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { getTournament, getTournamentName } from "@/lib/supabase/tournaments";
import { fetchMatchVisits } from "@/lib/supabase/visits";
import { LiveRefresh } from "../../live-refresh";
import { BoardQueue } from "./board-queue";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: PageProps<"/t/[id]/board/[n]">): Promise<Metadata> {
  const { id, n } = await params;
  const name = UUID_RE.test(id) ? await getTournamentName(id).catch(() => null) : null;
  return name ? { title: `${copy.board.title(Number(n))} · ${name}` } : {};
}

export default function BoardPage({ params }: PageProps<"/t/[id]/board/[n]">) {
  return (
    <Suspense fallback={<p className="text-muted">{copy.common.loading}</p>}>
      <BoardContent params={params} />
    </Suspense>
  );
}

async function BoardContent({ params }: { params: PageProps<"/t/[id]/board/[n]">["params"] }) {
  const { id, n } = await params;
  const board = Number(n);
  if (!UUID_RE.test(id) || !Number.isInteger(board)) notFound();

  const viewer = await getViewer();
  if (!viewer?.isOrganizer) {
    return (
      <div className="space-y-3">
        <p className={alertWarn}>{copy.board.loginNeeded}</p>
        {!viewer && (
          <Link href={`/login?next=/t/${id}/board/${board}`} className={btnPrimary}>
            {copy.nav.login}
          </Link>
        )}
      </div>
    );
  }

  const data = await Promise.all([getTournament(id), getSettings()]).catch(() => null);
  if (!data) return <p className={alertError}>{copy.common.loadError}</p>;
  const [t, settings] = data;
  if (!t || board < 1 || board > t.boards) notFound();

  const names = Object.fromEntries(t.entrants.map((e) => [e.playerId, e.name]));
  const rounds = t.ko?.rounds ?? 0;
  const live = liveOnBoard(t.matches, board);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Link href={`/t/${t.id}`} className="inline-flex min-h-11 items-center text-sm text-muted hover:text-cream">
        ← {t.name}
      </Link>
      <nav aria-label={copy.board.switchLabel} className="flex flex-wrap gap-1">
        {Array.from({ length: t.boards }, (_, i) => i + 1).map((b) => (
          <Link
            key={b}
            href={`/t/${t.id}/board/${b}`}
            aria-current={b === board ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ${
              b === board ? "bg-surface-2 text-cream ring-1 ring-gold/60" : "text-muted hover:text-cream"
            }`}
          >
            {copy.board.title(b)}
          </Link>
        ))}
      </nav>
    </div>
  );

  if (live) {
    const visits = await fetchMatchVisits(await createClient(), live.id).catch(() => null);
    if (!visits) return <p className={alertError}>{copy.common.loadError}</p>;
    return (
      <div className="space-y-3">
        <LiveRefresh tournamentId={t.id} />
        {header}
        <Scoreboard
          key={live.id}
          tournamentId={t.id}
          matchId={live.id}
          label={matchLabel(live, rounds)}
          players={[names[live.p1!] ?? "", names[live.p2!] ?? ""]}
          startScore={live.startScore}
          bestOf={live.bestOf}
          askDoubles={settings.askDoubles}
          initial={visits}
        />
      </div>
    );
  }

  const busy = busyPlayers(t.matches);
  const next = t.status === "done" ? null : nextMatch(t.matches);
  const others = t.status === "done" ? [] : waitingMatches(t.matches).filter((m) => m.id !== next?.id);
  const toCard = (m: (typeof t.matches)[number]) => ({
    id: m.id,
    label: matchLabel(m, rounds),
    p1: names[m.p1!] ?? "",
    p2: names[m.p2!] ?? "",
    format: copy.tournament.bestOf(m.startScore, m.bestOf),
    playable: isPlayable(m, busy),
  });
  const empty =
    t.status === "done"
      ? copy.board.tournamentDone
      : t.matches.every((m) => m.status === "done")
        ? copy.board.allPlayed
        : copy.board.noneReady;

  return (
    <div className="space-y-4">
      <LiveRefresh tournamentId={t.id} />
      {header}
      <h1 className="font-display text-4xl font-bold tracking-wide uppercase">{copy.board.title(board)}</h1>
      <BoardQueue board={board} next={next ? toCard(next) : null} others={others.map(toCard)} empty={empty} />
    </div>
  );
}
