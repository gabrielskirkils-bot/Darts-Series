import "server-only";
import { computeElo, type EloMatch, type EloSettings } from "@/lib/domain/elo";
import type { ResultEntry } from "@/lib/domain/points";
import type {
  EloRow,
  FinishedTournament,
  ProfileMatch,
  RankingData,
  TournamentStat,
} from "@/lib/domain/ranking";
import type { StatTotals } from "@/lib/domain/stats";
import type { MatchStage } from "@/lib/domain/tournament";
import { createClient } from "./server";
import type { Json } from "./types";

type Db = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------
// Elo (SPEC 4.11): replay every finished match of finished tournaments
// ---------------------------------------------------------------

/**
 * The full Elo history as JSON for `save_results` / `delete_tournament`.
 * `include` counts a tournament that is being finished; `exclude` drops one being deleted.
 */
export async function eloPayload(
  db: Db,
  settings: EloSettings,
  opts: { include?: string; exclude?: string } = {},
): Promise<Json> {
  const { data, error } = await db
    .from("matches")
    .select("id, tournament_id, p1, p2, winner_id, finished_at, tournaments!inner(date, status)")
    .eq("status", "done")
    .eq("is_bye", false);
  if (error) throw error;

  const matches: EloMatch[] = data
    .filter(
      (m) =>
        m.tournament_id !== opts.exclude &&
        (m.tournaments.status === "done" || m.tournament_id === opts.include) &&
        m.p1 &&
        m.p2 &&
        m.winner_id,
    )
    .map((m) => ({
      id: m.id,
      tournamentId: m.tournament_id,
      tournamentDate: m.tournaments.date,
      finishedAt: m.finished_at ?? "",
      p1: m.p1!,
      p2: m.p2!,
      winnerId: m.winner_id!,
    }));

  const { history } = computeElo(matches, settings);
  return history.map((h) => ({
    match_id: h.matchId,
    player_id: h.playerId,
    tournament_id: h.tournamentId,
    rating_before: h.ratingBefore,
    rating_after: h.ratingAfter,
    played_at: h.playedAt || new Date(0).toISOString(),
  }));
}

// ---------------------------------------------------------------
// Ranking and profile data
// ---------------------------------------------------------------

type StatsViewRow = {
  tournament_id: string | null;
  player_id: string | null;
  points: number | null;
  darts: number | null;
  first9_points: number | null;
  first9_darts: number | null;
  t180: number | null;
  t140: number | null;
  t100: number | null;
  highest_checkout: number | null;
  checkouts: number | null;
  darts_at_double: number | null;
  best_leg_darts: number | null;
};

export function toTotals(s: StatsViewRow): StatTotals {
  return {
    points: Number(s.points ?? 0),
    darts: Number(s.darts ?? 0),
    first9Points: Number(s.first9_points ?? 0),
    first9Darts: Number(s.first9_darts ?? 0),
    t180: Number(s.t180 ?? 0),
    t140: Number(s.t140 ?? 0),
    t100: Number(s.t100 ?? 0),
    highestCheckout: Number(s.highest_checkout ?? 0),
    checkouts: Number(s.checkouts ?? 0),
    dartsAtDouble: Number(s.darts_at_double ?? 0),
    bestLegDarts: s.best_leg_darts === null ? null : Number(s.best_leg_darts),
  };
}

export type PlayerName = { id: string; name: string; nickname: string | null; active: boolean };

export type RankingSource = RankingData & {
  players: Map<string, PlayerName>;
  /** A tournament that isn't finished yet (newest), for the "in progress" banner. */
  inProgress: { id: string; name: string } | null;
};

/** Everything the ranking page (and profiles) need, public via RLS. */
export async function getRankingData(): Promise<RankingSource> {
  const db = await createClient();
  const [tournaments, matches, results, stats, elo, players, open] = await Promise.all([
    db.from("tournaments").select("id, name, date, finished_at").eq("status", "done"),
    db.from("matches").select("tournament_id").eq("status", "done").eq("is_bye", false),
    db.from("tournament_results").select("tournament_id, player_id, place, points"),
    db.from("player_tournament_stats").select("*"),
    db.from("elo_history").select("tournament_id, player_id, rating_before, rating_after, played_at, match_id"),
    db.from("player_summary").select("id, name, nickname, active, elo"),
    db
      .from("tournaments")
      .select("id, name")
      .neq("status", "done")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  for (const r of [tournaments, matches, results, stats, elo, players, open]) if (r.error) throw r.error;

  const matchCount = new Map<string, number>();
  for (const m of matches.data!) matchCount.set(m.tournament_id, (matchCount.get(m.tournament_id) ?? 0) + 1);

  const finished: FinishedTournament[] = tournaments.data!.map((t) => ({
    id: t.id,
    name: t.name,
    date: t.date,
    finishedAt: t.finished_at,
    matches: matchCount.get(t.id) ?? 0,
  }));
  const dateOf = new Map(finished.map((t) => [t.id, t.date]));
  const finishedIds = new Set(finished.map((t) => t.id));

  const eloHistory: EloRow[] = elo
    .data!.filter((h) => dateOf.has(h.tournament_id))
    .sort(
      (a, b) =>
        dateOf.get(a.tournament_id)!.localeCompare(dateOf.get(b.tournament_id)!) ||
        a.played_at.localeCompare(b.played_at) ||
        a.match_id.localeCompare(b.match_id),
    )
    .map((h) => ({
      tournamentId: h.tournament_id,
      playerId: h.player_id,
      ratingBefore: Number(h.rating_before),
      ratingAfter: Number(h.rating_after),
      playedAt: h.played_at,
    }));

  const statRows: TournamentStat[] = stats
    .data!.filter((s) => s.tournament_id && s.player_id && finishedIds.has(s.tournament_id))
    .map((s) => ({ tournamentId: s.tournament_id!, playerId: s.player_id!, totals: toTotals(s) }));

  const resultRows: ResultEntry[] = results.data!.map((r) => ({
    tournamentId: r.tournament_id,
    playerId: r.player_id,
    place: r.place,
    points: r.points,
  }));

  const playerMap = new Map<string, PlayerName>();
  const currentElo = new Map<string, number>();
  for (const p of players.data!) {
    if (!p.id) continue;
    playerMap.set(p.id, { id: p.id, name: p.name ?? "", nickname: p.nickname, active: p.active ?? true });
    currentElo.set(p.id, Number(p.elo ?? 1500));
  }

  return {
    tournaments: finished,
    results: resultRows,
    stats: statRows,
    eloHistory,
    currentElo,
    players: playerMap,
    inProgress: open.data![0] ?? null,
  };
}

/** A player's finished matches in finished tournaments (profile records, recent, head-to-head). */
export async function getPlayerMatches(playerId: string): Promise<ProfileMatch[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("matches")
    .select(
      "id, tournament_id, p1, p2, legs_p1, legs_p2, winner_id, is_manual, finished_at, stage, group_index, round, tournaments!inner(status)",
    )
    .eq("status", "done")
    .eq("is_bye", false)
    .eq("tournaments.status", "done")
    .or(`p1.eq.${playerId},p2.eq.${playerId}`);
  if (error) throw error;
  return data
    .filter((m) => m.p1 && m.p2 && m.winner_id)
    .map((m) => ({
      id: m.id,
      tournamentId: m.tournament_id,
      p1: m.p1!,
      p2: m.p2!,
      legsP1: m.legs_p1,
      legsP2: m.legs_p2,
      winnerId: m.winner_id!,
      isManual: m.is_manual,
      finishedAt: m.finished_at,
      stage: m.stage as MatchStage,
      groupIndex: m.group_index,
      round: m.round,
    }));
}
