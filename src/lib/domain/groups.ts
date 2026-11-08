// Group draw (snake), round robin schedule and group tables (SPEC sections 4.3, 4.4).

export type Seeding = "elo" | "random";

/** A random number generator returning values in [0, 1). Pass Math.random from the caller. */
export type Rng = () => number;

/**
 * Orders entrants for the draw: by Elo descending (ties keep input order), or shuffled.
 */
export function orderEntrants<T extends { elo: number }>(
  entrants: readonly T[],
  seeding: Seeding,
  rng: Rng,
): T[] {
  if (seeding === "elo") {
    return entrants
      .map((e, i) => ({ e, i }))
      .sort((a, b) => b.e.elo - a.e.elo || a.i - b.i)
      .map(({ e }) => e);
  }
  const list = [...entrants];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

/** Group index for the i-th entrant (0-based) in a snake draw over G groups. */
export function snakeGroupIndex(i: number, groupCount: number): number {
  const row = Math.floor(i / groupCount);
  const col = i % groupCount;
  return row % 2 === 0 ? col : groupCount - 1 - col;
}

/** Splits ordered entrants into G groups by snake. */
export function snakeDraw<T>(ordered: readonly T[], groupCount: number): T[][] {
  const groups: T[][] = Array.from({ length: groupCount }, () => []);
  ordered.forEach((item, i) => groups[snakeGroupIndex(i, groupCount)]!.push(item));
  return groups;
}

/** Group sizes (in group order) that a snake draw of n entrants produces. */
export function snakeGroupSizes(n: number, groupCount: number): number[] {
  const sizes = new Array<number>(groupCount).fill(0);
  for (let i = 0; i < n; i++) sizes[snakeGroupIndex(i, groupCount)]! += 1;
  return sizes;
}

/**
 * Round robin by the circle method. Returns rounds of index pairs for `size` players;
 * a dummy is added for odd sizes and its pairings dropped (that player sits out).
 */
export function roundRobinRounds(size: number): [number, number][][] {
  if (size < 2) return [];
  const n = size % 2 === 0 ? size : size + 1;
  const dummy = size % 2 === 0 ? -1 : size;
  const ring = Array.from({ length: n }, (_, i) => i);
  const rounds: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i]!;
      const b = ring[n - 1 - i]!;
      if (a === dummy || b === dummy) continue;
      // Alternate sides of the fixed player so nobody is always listed first.
      round.push(i === 0 && r % 2 === 1 ? [b, a] : [a, b]);
    }
    rounds.push(round);
    // Rotate everyone except the first position.
    ring.splice(1, 0, ring.pop()!);
  }
  return rounds;
}

export type GroupMatchPlan<P> = {
  groupIndex: number;
  round: number; // 1-based
  p1: P;
  p2: P;
  sortOrder: number; // 0-based, interleaved across groups
};

/** All group matches, interleaved: round 1 of every group, then round 2, etc. */
export function scheduleGroupMatches<P>(groups: readonly (readonly P[])[]): GroupMatchPlan<P>[] {
  const perGroup = groups.map((g) => roundRobinRounds(g.length));
  const maxRounds = Math.max(0, ...perGroup.map((r) => r.length));
  const plan: GroupMatchPlan<P>[] = [];
  for (let r = 0; r < maxRounds; r++) {
    perGroup.forEach((rounds, g) => {
      for (const [a, b] of rounds[r] ?? []) {
        plan.push({
          groupIndex: g,
          round: r + 1,
          p1: groups[g]![a]!,
          p2: groups[g]![b]!,
          sortOrder: plan.length,
        });
      }
    });
  }
  return plan;
}

// ---------------------------------------------------------------
// Group table
// ---------------------------------------------------------------

export type ResultMatch = {
  p1: string;
  p2: string;
  legsP1: number;
  legsP2: number;
  winnerId: string | null;
};

export type StandingRow = {
  playerId: string;
  position: number; // 1-based
  played: number;
  wins: number;
  losses: number;
  legsWon: number;
  legsLost: number;
  legDiff: number;
  /** 3-dart average, null when no visit stats exist (e.g. fallback entries). */
  average: number | null;
};

/**
 * Group table. Order: wins → leg difference → legs won → head-to-head (exactly 2 tied)
 * → 3-dart average → input (seed) order.
 * `matches` should contain only finished, non-bye matches between these players.
 */
export function groupStandings(
  playerIds: readonly string[],
  matches: readonly ResultMatch[],
  averages: ReadonlyMap<string, number | null> = new Map(),
): StandingRow[] {
  const rows = new Map<string, Omit<StandingRow, "position">>();
  for (const id of playerIds) {
    rows.set(id, {
      playerId: id,
      played: 0,
      wins: 0,
      losses: 0,
      legsWon: 0,
      legsLost: 0,
      legDiff: 0,
      average: averages.get(id) ?? null,
    });
  }

  for (const m of matches) {
    const a = rows.get(m.p1);
    const b = rows.get(m.p2);
    if (!a || !b) continue;
    a.played++;
    b.played++;
    a.legsWon += m.legsP1;
    a.legsLost += m.legsP2;
    b.legsWon += m.legsP2;
    b.legsLost += m.legsP1;
    if (m.winnerId === m.p1) {
      a.wins++;
      b.losses++;
    } else if (m.winnerId === m.p2) {
      b.wins++;
      a.losses++;
    }
  }
  for (const r of rows.values()) r.legDiff = r.legsWon - r.legsLost;

  const seedIndex = new Map(playerIds.map((id, i) => [id, i]));
  const avg = (r: { average: number | null }) => r.average ?? -1;
  const primary = (a: Omit<StandingRow, "position">, b: Omit<StandingRow, "position">) =>
    b.wins - a.wins || b.legDiff - a.legDiff || b.legsWon - a.legsWon;

  const sorted = [...rows.values()].sort(
    (a, b) => primary(a, b) || seedIndex.get(a.playerId)! - seedIndex.get(b.playerId)!,
  );

  // Resolve tie clusters on the primary keys.
  const result: Omit<StandingRow, "position">[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i + 1;
    while (j < sorted.length && primary(sorted[i]!, sorted[j]!) === 0) j++;
    const cluster = sorted.slice(i, j);
    if (cluster.length === 2) {
      const [x, y] = cluster as [Omit<StandingRow, "position">, Omit<StandingRow, "position">];
      const h2h = headToHeadWinner(x.playerId, y.playerId, matches);
      if (h2h === y.playerId) cluster.reverse();
      else if (h2h === null && avg(y) > avg(x)) cluster.reverse();
    } else if (cluster.length > 2) {
      cluster.sort(
        (a, b) => avg(b) - avg(a) || seedIndex.get(a.playerId)! - seedIndex.get(b.playerId)!,
      );
    }
    result.push(...cluster);
    i = j;
  }

  return result.map((r, i) => ({ ...r, position: i + 1 }));
}

function headToHeadWinner(a: string, b: string, matches: readonly ResultMatch[]): string | null {
  let aWins = 0;
  let bWins = 0;
  for (const m of matches) {
    const pair = (m.p1 === a && m.p2 === b) || (m.p1 === b && m.p2 === a);
    if (!pair) continue;
    if (m.winnerId === a) aWins++;
    else if (m.winnerId === b) bWins++;
  }
  if (aWins === bWins) return null;
  return aWins > bWins ? a : b;
}
