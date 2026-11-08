// Elo rating (SPEC section 4.11). Always recomputed from scratch over all finished matches,
// plus a placing step per tournament so going further in a tournament is worth more.

export type EloSettings = {
  /** K for each match. */
  k: number;
  start: number;
  /** K for the final placing of a tournament, spread over the field (0 = matches only). */
  placeK?: number;
};

export const DEFAULT_ELO: Required<EloSettings> = { k: 16, placeK: 48, start: 1500 };

/** A frozen final place (tournament_results). */
export type EloPlacement = { tournamentId: string; playerId: string; place: number };

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
 * Placing step for one tournament: every pair of players counts as one result decided by
 * final place (better place = win, shared place = draw), with `placeK` spread over the
 * N − 1 opponents. Zero-sum; a player finishing lower never gains more than one finishing
 * higher against the same field.
 */
export function placingDeltas(
  places: ReadonlyMap<string, number>,
  ratings: ReadonlyMap<string, number>,
  placeK: number,
): Map<string, number> {
  const ids = [...places.keys()];
  const deltas = new Map<string, number>();
  if (ids.length < 2 || placeK <= 0) return deltas;
  const perPair = placeK / (ids.length - 1);
  for (const i of ids) {
    let sum = 0;
    for (const j of ids) {
      if (i === j) continue;
      const pi = places.get(i)!;
      const pj = places.get(j)!;
      const score = pi < pj ? 1 : pi === pj ? 0.5 : 0;
      sum += score - expectedScore(ratings.get(i)!, ratings.get(j)!);
    }
    deltas.set(i, perPair * sum);
  }
  return deltas;
}

/**
 * Replays matches chronologically (tournament date, then finished_at, then id) and returns
 * the history rows plus each player's final rating. Byes are skipped. After a tournament's
 * last match, the placing step (if `placements` has its places) is added to each placed
 * player's last match row of that tournament, so history stays one row per match and
 * stays continuous. Ratings in the history are rounded to 2 decimals; computation keeps
 * full precision.
 */
export function computeElo(
  matches: readonly EloMatch[],
  settings: EloSettings = DEFAULT_ELO,
  placements: readonly EloPlacement[] = [],
): { history: EloEntry[]; ratings: Map<string, number> } {
  const ordered = matches
    .filter((m) => !m.isBye && m.p1 && m.p2 && (m.winnerId === m.p1 || m.winnerId === m.p2))
    .sort(
      (a, b) =>
        a.tournamentDate.localeCompare(b.tournamentDate) ||
        a.finishedAt.localeCompare(b.finishedAt) ||
        a.id.localeCompare(b.id),
    );

  const placeK = settings.placeK ?? 0;
  const placesByTournament = new Map<string, Map<string, number>>();
  for (const p of placements) {
    const map = placesByTournament.get(p.tournamentId) ?? new Map<string, number>();
    map.set(p.playerId, p.place);
    placesByTournament.set(p.tournamentId, map);
  }
  const lastIndex = new Map<string, number>();
  ordered.forEach((m, i) => lastIndex.set(m.tournamentId, i));

  const ratings = new Map<string, number>();
  const rating = (id: string) => ratings.get(id) ?? settings.start;
  const history: EloEntry[] = [];
  /** Index in `history` of each player's latest row, per tournament. */
  const lastRow = new Map<string, number>();

  ordered.forEach((m, i) => {
    const r1 = rating(m.p1);
    const r2 = rating(m.p2);
    const s1: 0 | 1 = m.winnerId === m.p1 ? 1 : 0;
    const n1 = newRating(r1, r2, s1, settings.k);
    const n2 = newRating(r2, r1, s1 === 1 ? 0 : 1, settings.k);
    ratings.set(m.p1, n1);
    ratings.set(m.p2, n2);
    const base = { matchId: m.id, tournamentId: m.tournamentId, playedAt: m.finishedAt };
    history.push({ ...base, playerId: m.p1, ratingBefore: round2(r1), ratingAfter: round2(n1) });
    lastRow.set(`${m.tournamentId}:${m.p1}`, history.length - 1);
    history.push({ ...base, playerId: m.p2, ratingBefore: round2(r2), ratingAfter: round2(n2) });
    lastRow.set(`${m.tournamentId}:${m.p2}`, history.length - 1);

    if (lastIndex.get(m.tournamentId) !== i) return;
    const places = placesByTournament.get(m.tournamentId);
    if (!places || placeK <= 0) return;
    // Only players who played a match here can carry the adjustment.
    const placed = new Map([...places].filter(([id]) => lastRow.has(`${m.tournamentId}:${id}`)));
    const deltas = placingDeltas(placed, new Map([...placed.keys()].map((id) => [id, rating(id)])), placeK);
    for (const [id, delta] of deltas) {
      const next = rating(id) + delta;
      ratings.set(id, next);
      history[lastRow.get(`${m.tournamentId}:${id}`)!]!.ratingAfter = round2(next);
    }
  });

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
