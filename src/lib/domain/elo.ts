// Elo rating (SPEC section 4.11). Always recomputed from scratch over all finished matches.

export type EloSettings = { k: number; start: number };

export const DEFAULT_ELO: EloSettings = { k: 32, start: 1500 };

export type EloMatch = {
  id: string;
  tournamentId: string;
  /** Tournament date, YYYY-MM-DD. */
  tournamentDate: string;
  /** ISO timestamp the match finished. */
  finishedAt: string;
  p1: string;
  p2: string;
  winnerId: string;
  isBye?: boolean;
};

export type EloEntry = {
  matchId: string;
  playerId: string;
  tournamentId: string;
  ratingBefore: number;
  ratingAfter: number;
  playedAt: string;
};

export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + 10 ** ((rb - ra) / 400));
}

export function newRating(ra: number, rb: number, score: 0 | 1, k: number): number {
  return ra + k * (score - expectedScore(ra, rb));
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Replays matches chronologically (tournament date, then finished_at, then id) and returns
 * the history rows plus each player's final rating. Byes are skipped. Ratings in the
 * history are rounded to 2 decimals; computation keeps full precision.
 */
export function computeElo(
  matches: readonly EloMatch[],
  settings: EloSettings = DEFAULT_ELO,
): { history: EloEntry[]; ratings: Map<string, number> } {
  const ordered = matches
    .filter((m) => !m.isBye && m.p1 && m.p2 && (m.winnerId === m.p1 || m.winnerId === m.p2))
    .sort(
      (a, b) =>
        a.tournamentDate.localeCompare(b.tournamentDate) ||
        a.finishedAt.localeCompare(b.finishedAt) ||
        a.id.localeCompare(b.id),
    );

  const ratings = new Map<string, number>();
  const rating = (id: string) => ratings.get(id) ?? settings.start;
  const history: EloEntry[] = [];

  for (const m of ordered) {
    const r1 = rating(m.p1);
    const r2 = rating(m.p2);
    const s1: 0 | 1 = m.winnerId === m.p1 ? 1 : 0;
    const n1 = newRating(r1, r2, s1, settings.k);
    const n2 = newRating(r2, r1, s1 === 1 ? 0 : 1, settings.k);
    ratings.set(m.p1, n1);
    ratings.set(m.p2, n2);
    const base = { matchId: m.id, tournamentId: m.tournamentId, playedAt: m.finishedAt };
    history.push({ ...base, playerId: m.p1, ratingBefore: round2(r1), ratingAfter: round2(n1) });
    history.push({ ...base, playerId: m.p2, ratingBefore: round2(r2), ratingAfter: round2(n2) });
  }

  return { history, ratings: new Map([...ratings].map(([id, r]) => [id, round2(r)])) };
}

/**
 * Elo change for a player in a tournament: rating after their last match there minus
 * rating before their first. `history` must be in replay order (as computeElo returns it).
 */
export function eloChange(
  history: readonly EloEntry[],
  playerId: string,
  tournamentId: string,
): number | null {
  const rows = history.filter((h) => h.playerId === playerId && h.tournamentId === tournamentId);
  if (rows.length === 0) return null;
  return round2(rows.at(-1)!.ratingAfter - rows[0]!.ratingBefore);
}
