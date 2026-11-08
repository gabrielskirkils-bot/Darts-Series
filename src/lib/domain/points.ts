// Points per place and the overall ranking (SPEC sections 4.9, 4.10).

export type PointsRow = { place: number; pts: number };

export const DEFAULT_POINTS: PointsRow[] = [
  { place: 1, pts: 100 },
  { place: 2, pts: 75 },
  { place: 3, pts: 60 },
  { place: 4, pts: 50 },
  { place: 5, pts: 40 },
  { place: 9, pts: 25 },
  { place: 17, pts: 15 },
  { place: 33, pts: 10 },
];

/** Points of the largest row with "from place" ≤ place; 0 if none applies. */
export function pointsForPlace(place: number, table: readonly PointsRow[]): number {
  let best: PointsRow | null = null;
  for (const row of table) {
    if (row.place <= place && (!best || row.place > best.place)) best = row;
  }
  return best?.pts ?? 0;
}

// ---------------------------------------------------------------
// Period filter (seasons later)
// ---------------------------------------------------------------

export type Period = { kind: "all" } | { kind: "year"; year: number };

/** `date` is an ISO date (YYYY-MM-DD). */
export function inPeriod(date: string, period: Period): boolean {
  if (period.kind === "all") return true;
  return Number(date.slice(0, 4)) === period.year;
}

// ---------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------

export type ResultEntry = {
  tournamentId: string;
  playerId: string;
  place: number;
  points: number;
};

export type RankingRow = {
  playerId: string;
  position: number; // shared on equal points
  points: number;
  tournaments: number;
  wins: number;
  bestFinish: number;
  average: number | null;
};

/**
 * Ranking from frozen tournament results. Sorted by points → tournament wins → average;
 * players with equal points share a position.
 */
export function rankPlayers(
  results: readonly ResultEntry[],
  averages: ReadonlyMap<string, number | null> = new Map(),
): RankingRow[] {
  const rows = new Map<string, Omit<RankingRow, "position">>();
  for (const r of results) {
    const row = rows.get(r.playerId) ?? {
      playerId: r.playerId,
      points: 0,
      tournaments: 0,
      wins: 0,
      bestFinish: Infinity,
      average: averages.get(r.playerId) ?? null,
    };
    row.points += r.points;
    row.tournaments += 1;
    if (r.place === 1) row.wins += 1;
    row.bestFinish = Math.min(row.bestFinish, r.place);
    rows.set(r.playerId, row);
  }

  const sorted = [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      (b.average ?? -1) - (a.average ?? -1) ||
      a.playerId.localeCompare(b.playerId),
  );
  return sorted.map((r) => ({
    ...r,
    position: 1 + sorted.filter((o) => o.points > r.points).length,
  }));
}

export type Movement = { kind: "new" } | { kind: "same" } | { kind: "up" | "down"; by: number };

/**
 * Movement vs the ranking before the last tournament. `previous` = rankPlayers over all
 * results except that tournament.
 */
export function rankingMovement(
  current: readonly RankingRow[],
  previous: readonly RankingRow[],
): Map<string, Movement> {
  const before = new Map(previous.map((r) => [r.playerId, r.position]));
  const result = new Map<string, Movement>();
  for (const r of current) {
    const old = before.get(r.playerId);
    if (old === undefined) result.set(r.playerId, { kind: "new" });
    else if (old === r.position) result.set(r.playerId, { kind: "same" });
    else if (old > r.position) result.set(r.playerId, { kind: "up", by: old - r.position });
    else result.set(r.playerId, { kind: "down", by: r.position - old });
  }
  return result;
}
