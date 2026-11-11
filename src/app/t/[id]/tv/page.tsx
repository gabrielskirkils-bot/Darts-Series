import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { copy, matchLabel } from "@/lib/copy";
import { boardAssignments } from "@/lib/domain/queue";
import { rankingView, statsTable } from "@/lib/domain/ranking";
import { latestResults, tournamentOverview } from "@/lib/domain/tournament";
import { getRankingData } from "@/lib/supabase/ranking";
import { createClient } from "@/lib/supabase/server";
import { getTournament, getTournamentName } from "@/lib/supabase/tournaments";
import { fetchMatchVisits } from "@/lib/supabase/visits";
import { LiveRefresh } from "../live-refresh";
import { TvScreen, type TvBoard } from "./tv-screen";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const LATEST = 6;
const TOP = 10;

export async function generateMetadata({ params }: PageProps<"/t/[id]/tv">): Promise<Metadata> {
  const { id } = await params;
  const name = UUID_RE.test(id) ? await getTournamentName(id).catch(() => null) : null;
  return name ? { title: copy.tv.pageTitle(name) } : {};
}

/** Public TV screen (SPEC 4.13): full screen, no login, live via Realtime. */
export default function TvPage({ params }: PageProps<"/t/[id]/tv">) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-bg bg-[radial-gradient(120%_70%_at_50%_-20%,rgb(23_48_95/0.6),transparent_70%)] text-ink">
      <div aria-hidden className="brand-stripe absolute inset-x-0 top-0 h-[0.5vh]" />
      <Suspense fallback={<p className="p-[2vw] text-[2vw] text-muted">{copy.common.loading}</p>}>
        <TvContent params={params} />
      </Suspense>
    </div>
  );
}

async function TvContent({ params }: { params: PageProps<"/t/[id]/tv">["params"] }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const data = await Promise.all([getTournament(id), getRankingData()]).catch(() => null);
  if (!data) return <p className="p-[2vw] text-[2vw]">{copy.common.loadError}</p>;
  const [t, ranking] = data;
  if (!t) notFound();

  const names = Object.fromEntries(t.entrants.map((e) => [e.playerId, e.name]));
  const overview = tournamentOverview(t);
  const rounds = overview.rounds;
  const db = await createClient();

  const boards: TvBoard[] = await Promise.all(
    boardAssignments(t.matches, t.boards).map(async ({ board, live, next }) => {
      if (live) {
        const initial = await fetchMatchVisits(db, live.id).catch(() => ({ firstStarter: 0 as const, visits: [] }));
        return {
          board,
          live: {
            id: live.id,
            label: matchLabel(live, rounds),
            players: [names[live.p1!] ?? "", names[live.p2!] ?? ""] as [string, string],
            startScore: live.startScore,
            bestOf: live.bestOf,
            initial,
          },
          next: null,
        };
      }
      return {
        board,
        live: null,
        next: next
          ? { label: matchLabel(next, rounds), players: [names[next.p1!] ?? "", names[next.p2!] ?? ""] as [string, string] }
          : null,
      };
    }),
  );

  const top = rankingView(ranking, { kind: "all" }).rows.slice(0, TOP);

  return (
    <>
      <LiveRefresh tournamentId={t.id} />
      <TvScreen
        name={t.name}
        status={t.status}
        progress={overview.progress}
        winner={t.results.find((r) => r.place === 1)?.playerId ?? null}
        names={names}
        boards={boards}
        tables={t.format === "ko" ? [] : overview.tables}
        isRoundRobin={t.format === "rr"}
        qualifiers={overview.qualifiers}
        bracket={overview.bracket}
        rounds={rounds}
        leaders={statsTable(t.stats).leaders}
        ranking={top.map((r) => ({
          playerId: r.playerId,
          name: ranking.players.get(r.playerId)?.name ?? "",
          position: r.position,
          points: r.points,
          average: r.average,
        }))}
        latest={latestResults(t.matches, LATEST).map((m) => ({
          id: m.id,
          label: matchLabel(m, rounds),
          p1: names[m.p1!] ?? "",
          p2: names[m.p2!] ?? "",
          legsP1: m.legsP1,
          legsP2: m.legsP2,
          winnerSide: m.winnerId === m.p1 ? 0 : 1,
        }))}
      />
    </>
  );
}
