// Ranking page and player profile view models (SPEC 4.2, 4.10). Pure: the data layer
// passes in finished tournaments, frozen results, per-tournament stats and Elo history.

import {
  inPeriod,
  rankingMovement,
  rankPlayers,
  type Movement,
  type Period,
  type RankingRow,
  type ResultEntry,
} from "./points";
import {
  checkoutPercent,
  combineTotals,
  first9Average,
  headToHead,
  playerRecord,
  threeDartAverage,
  type PlayerRecord,
  type StatTotals,
} from "./stats";

export type FinishedTournament = {
  id: string;
  name: string;
  date: string;
  finishedAt: string | null;
  /** Finished, non-bye matches. */
  matches: number;
};

export type TournamentStat = { tournamentId: string; playerId: string; totals: StatTotals };

/** One player's Elo row, in replay order. */
export type EloRow = {
  tournamentId: string;
  playerId: string;
  ratingBefore: number;
  ratingAfter: number;
  playedAt: string;
};

export type RankingData = {
  tournaments: readonly FinishedTournament[];
  results: readonly ResultEntry[];
  stats: readonly TournamentStat[];
  eloHistory: readonly EloRow[];
  currentElo: ReadonlyMap<string, number>;
};

/** Newest first: tournament date, then finish time. */
function byRecency(a: FinishedTournament, b: FinishedTournament): number {
  return b.date.localeCompare(a.date) || (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "");
}

/** Years that have finished tournaments, newest first (period filter options). */
export function rankingYears(tournaments: readonly FinishedTournament[]): number[] {
  return [...new Set(tournaments.map((t) => Number(t.date.slice(0, 4))))].sort((a, b) => b - a);
}

function totalsByPlayer(stats: readonly TournamentStat[], ids: ReadonlySet<string>): Map<string, StatTotals> {
  const grouped = new Map<string, StatTotals[]>();
  for (const s of stats) {
    if (!ids.has(s.tournamentId)) continue;
    grouped.set(s.playerId, [...(grouped.get(s.playerId) ?? []), s.totals]);
  }
  return new Map([...grouped].map(([id, list]) => [id, combineTotals(list)]));
}

/** Rating after the player's last match in a tournament minus before their first; null if absent. */
export function tournamentEloChange(
  history: readonly EloRow[],
  playerId: string,
  tournamentId: string,
): number | null {
  const rows = history.filter((h) => h.playerId === playerId && h.tournamentId === tournamentId);
  if (rows.length === 0) return null;
  return Math.round((rows.at(-1)!.ratingAfter - rows[0]!.ratingBefore) * 100) / 100;
}

export type RankingViewRow = RankingRow & {
  movement: Movement;
  t180: number;
  highestCheckout: number;
  elo: number | null;
  /** Change in the period's last tournament (null if the player wasn't in it). */
  eloChange: number | null;
};

export type RankingView = {
  rows: RankingViewRow[];
  summary: {
    tournaments: number;
    matches: number;
    t180: number;
    highestCheckout: { score: number; playerId: string } | null;
  };
  last: { tournament: FinishedTournament; podium: ResultEntry[] } | null;
};

/**
 * The ranking for a period: points → wins → average with shared positions, movement against
 * the ranking before the period's last tournament, and the period summary.
 */
export function rankingView(data: RankingData, period: Period): RankingView {
  const tournaments = data.tournaments.filter((t) => inPeriod(t.date, period)).sort(byRecency);
  const ids = new Set(tournaments.map((t) => t.id));
  const results = data.results.filter((r) => ids.has(r.tournamentId));
  const totals = totalsByPlayer(data.stats, ids);
  const averages = new Map([...totals].map(([id, t]) => [id, threeDartAverage(t.points, t.darts)]));

  const last = tournaments[0] ?? null;
  const current = rankPlayers(results, averages);
  const previous = last ? rankPlayers(results.filter((r) => r.tournamentId !== last.id), averages) : current;
  const movement = rankingMovement(current, previous);

  let best: { score: number; playerId: string } | null = null;
  let t180 = 0;
  for (const [playerId, t] of totals) {
    t180 += t.t180;
    if (t.highestCheckout > 0 && (!best || t.highestCheckout > best.score)) {
      best = { score: t.highestCheckout, playerId };
    }
  }

  return {
    rows: current.map((r) => ({
      ...r,
      movement: movement.get(r.playerId) ?? { kind: "same" },
      t180: totals.get(r.playerId)?.t180 ?? 0,
      highestCheckout: totals.get(r.playerId)?.highestCheckout ?? 0,
      elo: data.currentElo.get(r.playerId) ?? null,
      eloChange: last ? tournamentEloChange(data.eloHistory, r.playerId, last.id) : null,
    })),
    summary: {
      tournaments: tournaments.length,
      matches: tournaments.reduce((sum, t) => sum + t.matches, 0),
      t180,
      highestCheckout: best,
    },
    last: last
      ? {
          tournament: last,
          podium: results
            .filter((r) => r.tournamentId === last.id && r.place <= 3)
            .sort((a, b) => a.place - b.place),
        }
      : null,
  };
}

// ---------------------------------------------------------------
// Tournament Stats tab (stats for the day + leaders)
// ---------------------------------------------------------------

export type StatsTableRow = {
  playerId: string;
  average: number | null;
  first9: number | null;
  t180: number;
  t140: number;
  t100: number;
  highestCheckout: number;
  checkoutPercent: number | null;
  bestLeg: number | null;
};

export type Leader = { playerId: string; value: number } | null;

/** Per-player stats (players with visit stats only), best average first, plus leaders. */
export function statsTable(stats: Readonly<Record<string, StatTotals>>): {
  rows: StatsTableRow[];
  leaders: { average: Leader; t180: Leader; highestCheckout: Leader; bestLeg: Leader };
} {
  const rows: StatsTableRow[] = Object.entries(stats)
    .filter(([, t]) => t.darts > 0)
    .map(([playerId, t]) => ({
      playerId,
      average: threeDartAverage(t.points, t.darts),
      first9: first9Average(t),
      t180: t.t180,
      t140: t.t140,
      t100: t.t100,
      highestCheckout: t.highestCheckout,
      checkoutPercent: checkoutPercent(t),
      bestLeg: t.bestLegDarts,
    }))
    .sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || a.playerId.localeCompare(b.playerId));

  const top = (value: (r: StatsTableRow) => number | null, lowest = false): Leader => {
    let best: Leader = null;
    for (const r of rows) {
      const v = value(r);
      if (v === null || v <= 0) continue;
      if (!best || (lowest ? v < best.value : v > best.value)) best = { playerId: r.playerId, value: v };
    }
    return best;
  };

  return {
    rows,
    leaders: {
      average: top((r) => r.average),
      t180: top((r) => r.t180),
      highestCheckout: top((r) => r.highestCheckout),
      bestLeg: top((r) => r.bestLeg, true),
    },
  };
}

// ---------------------------------------------------------------
// Player profile
// ---------------------------------------------------------------

export type ProfileMatch = {
  id: string;
  tournamentId: string;
  p1: string;
  p2: string;
  legsP1: number;
  legsP2: number;
  winnerId: string;
  isManual: boolean;
  finishedAt: string | null;
  stage: "group" | "ko" | "third";
  groupIndex: number | null;
  round: number;
};

export type ProfileData = RankingData & {
  playerId: string;
  /** This player's finished matches in finished tournaments. */
  matches: readonly ProfileMatch[];
};

export type ProfileTiles = {
  average: number | null;
  first9: number | null;
  t180: number;
  t140: number;
  t100: number;
  highestCheckout: number;
  checkoutPercent: number | null;
  bestLeg: number | null;
  record: PlayerRecord;
  wins: number;
  bestFinish: number | null;
};

export type ProfileHistoryRow = {
  tournament: FinishedTournament;
  place: number;
  points: number;
  average: number | null;
  t180: number;
};

export type PlayerProfile = {
  ranking: { position: number; points: number } | null;
  elo: number | null;
  /** Change in the last tournament the player finished. */
  eloChange: number | null;
  tiles: ProfileTiles;
  /** Rating after each tournament, oldest first (starts with the rating before the first). */
  eloSeries: { label: string; date: string; rating: number }[];
  /** 3-dart average per tournament with visit stats, oldest first. */
  averageSeries: { label: string; date: string; average: number }[];
  history: ProfileHistoryRow[];
  recent: (ProfileMatch & { tournament: FinishedTournament; opponentId: string; won: boolean })[];
  headToHead: { opponentId: string; won: number; lost: number }[];
};

export const RECENT_MATCHES = 10;

export function playerProfile(data: ProfileData, period: Period): PlayerProfile {
  const id = data.playerId;
  const ranking = rankingView(data, period);
  const own = ranking.rows.find((r) => r.playerId === id);
  const inPeriodIds = new Set(data.tournaments.filter((t) => inPeriod(t.date, period)).map((t) => t.id));
  const byId = new Map(data.tournaments.map((t) => [t.id, t]));
  const chronological = [...data.tournaments].sort((a, b) => -byRecency(a, b));

  const myStats = data.stats.filter((s) => s.playerId === id);
  const totals = combineTotals(myStats.filter((s) => inPeriodIds.has(s.tournamentId)).map((s) => s.totals));
  const myResults = data.results.filter((r) => r.playerId === id);
  const periodResults = myResults.filter((r) => inPeriodIds.has(r.tournamentId));
  const periodMatches = data.matches.filter((m) => inPeriodIds.has(m.tournamentId));

  const statsByTournament = new Map(myStats.map((s) => [s.tournamentId, s.totals]));
  const myElo = data.eloHistory.filter((h) => h.playerId === id);

  const eloSeries: PlayerProfile["eloSeries"] = [];
  for (const t of chronological) {
    const rows = myElo.filter((h) => h.tournamentId === t.id);
    if (rows.length === 0) continue;
    if (eloSeries.length === 0) eloSeries.push({ label: "", date: t.date, rating: rows[0]!.ratingBefore });
    eloSeries.push({ label: t.name, date: t.date, rating: rows.at(-1)!.ratingAfter });
  }

  const averageSeries: PlayerProfile["averageSeries"] = [];
  for (const t of chronological) {
    const s = statsByTournament.get(t.id);
    const avg = s ? threeDartAverage(s.points, s.darts) : null;
    if (avg !== null) averageSeries.push({ label: t.name, date: t.date, average: avg });
  }

  const lastPlayed = chronological.filter((t) => myElo.some((h) => h.tournamentId === t.id)).at(-1);

  const history = myResults
    .map((r) => {
      const tournament = byId.get(r.tournamentId);
      const s = statsByTournament.get(r.tournamentId);
      return tournament
        ? {
            tournament,
            place: r.place,
            points: r.points,
            average: s ? threeDartAverage(s.points, s.darts) : null,
            t180: s?.t180 ?? 0,
          }
        : null;
    })
    .filter((x): x is ProfileHistoryRow => x !== null)
    .sort((a, b) => byRecency(a.tournament, b.tournament));

  const recent = data.matches
    .map((m) => {
      const tournament = byId.get(m.tournamentId);
      if (!tournament) return null;
      return { ...m, tournament, opponentId: m.p1 === id ? m.p2 : m.p1, won: m.winnerId === id };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => byRecency(a.tournament, b.tournament) || (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))
    .slice(0, RECENT_MATCHES);

  const h2h = [...headToHead(id, data.matches)]
    .map(([opponentId, wl]) => ({ opponentId, ...wl }))
    .sort((a, b) => b.won + b.lost - (a.won + a.lost) || b.won - a.won || a.opponentId.localeCompare(b.opponentId));

  return {
    ranking: own ? { position: own.position, points: own.points } : null,
    elo: data.currentElo.get(id) ?? null,
    eloChange: lastPlayed ? tournamentEloChange(data.eloHistory, id, lastPlayed.id) : null,
    tiles: {
      average: threeDartAverage(totals.points, totals.darts),
      first9: first9Average(totals),
      t180: totals.t180,
      t140: totals.t140,
      t100: totals.t100,
      highestCheckout: totals.highestCheckout,
      checkoutPercent: checkoutPercent(totals),
      bestLeg: totals.bestLegDarts,
      record: playerRecord(id, periodMatches),
      wins: periodResults.filter((r) => r.place === 1).length,
      bestFinish: periodResults.length ? Math.min(...periodResults.map((r) => r.place)) : null,
    },
    eloSeries,
    averageSeries,
    history,
    recent,
    headToHead: h2h,
  };
}
