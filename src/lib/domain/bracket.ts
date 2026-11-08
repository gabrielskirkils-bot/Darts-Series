// Knockout: seeds, bracket, byes, clash avoidance and advancement (SPEC section 4.5).

import type { StandingRow } from "./groups";

/** Smallest power of two ≥ qualified (minimum 2). */
export function bracketSize(qualified: number): number {
  let size = 2;
  while (size < qualified) size *= 2;
  return size;
}

export function roundCount(size: number): number {
  return Math.round(Math.log2(size));
}

/** Standard seed order, e.g. 8 → [1, 8, 4, 5, 2, 7, 3, 6]. First-round pairs are adjacent. */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order.slice(0, Math.max(size, 0));
}

/** Byes only ever sit in round 1; a semi-final contains one only in a 4-bracket with 3 players. */
export function semiFinalHasBye(size: number, qualified: number): boolean {
  return size === 4 && qualified < 4;
}

export type RoundName = "final" | "semiFinal" | "quarterFinal" | "last16" | "last32" | "lastN";

/** Round name counted from the end: k = 1 is the final. */
export function roundNameFromEnd(k: number): { name: RoundName; size: number } {
  const size = 2 ** k;
  if (k === 1) return { name: "final", size };
  if (k === 2) return { name: "semiFinal", size };
  if (k === 3) return { name: "quarterFinal", size };
  if (k === 4) return { name: "last16", size };
  if (k === 5) return { name: "last32", size };
  return { name: "lastN", size };
}

export function roundName(round: number, totalRounds: number) {
  return roundNameFromEnd(totalRounds - round + 1);
}

// ---------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------

export type SeededPlayer = {
  playerId: string;
  /** Group index, null in "knockout only". */
  group: number | null;
};

/**
 * Knockout seeds from group tables (each in group order A, B, …).
 * Tier 1 = group winners in group order; tier 2 = runners-up in reverse group order;
 * tier 3+ = by performance (win rate → leg difference per match → legs won per match → average).
 */
export function seedsFromGroups(
  tables: readonly (readonly StandingRow[])[],
  advance: number,
): SeededPlayer[] {
  const seeds: SeededPlayer[] = [];
  for (let pos = 1; pos <= advance; pos++) {
    const tier = tables
      .map((rows, group) => ({ row: rows.find((r) => r.position === pos), group }))
      .filter((x): x is { row: StandingRow; group: number } => x.row !== undefined);

    if (pos === 2) tier.reverse();
    else if (pos >= 3) {
      const rate = (n: number, r: StandingRow) => (r.played ? n / r.played : 0);
      tier.sort(
        (a, b) =>
          rate(b.row.wins, b.row) - rate(a.row.wins, a.row) ||
          rate(b.row.legDiff, b.row) - rate(a.row.legDiff, a.row) ||
          rate(b.row.legsWon, b.row) - rate(a.row.legsWon, a.row) ||
          (b.row.average ?? -1) - (a.row.average ?? -1) ||
          a.group - b.group,
      );
    }
    for (const { row, group } of tier) seeds.push({ playerId: row.playerId, group });
  }
  return seeds;
}

/**
 * Bracket positions: slots[seed - 1] = player at that seed (null = bye), after swapping
 * lower seeds within their tier so that no first-round pair is from the same group.
 * `groupCount` defines tier size; pass 1 (or null groups) to skip clash avoidance.
 */
export function placeSeeds(
  seeds: readonly SeededPlayer[],
  groupCount: number,
): (SeededPlayer | null)[] {
  const size = bracketSize(seeds.length);
  const bySeed: (SeededPlayer | null)[] = Array.from({ length: size }, (_, i) => seeds[i] ?? null);
  if (groupCount <= 1) return bySeed;

  const order = seedOrder(size);
  const opponentSeed = new Map<number, number>();
  for (let i = 0; i < order.length; i += 2) {
    opponentSeed.set(order[i]!, order[i + 1]!);
    opponentSeed.set(order[i + 1]!, order[i]!);
  }
  const tierOf = (seed: number) => Math.ceil(seed / groupCount);
  const clashAt = (seed: number) => {
    const a = bySeed[seed - 1];
    const b = bySeed[opponentSeed.get(seed)! - 1];
    return !!a && !!b && a.group !== null && a.group === b.group;
  };
  const swap = (x: number, y: number) => {
    [bySeed[x - 1], bySeed[y - 1]] = [bySeed[y - 1]!, bySeed[x - 1]!];
  };

  for (let guard = 0; guard < size * size; guard++) {
    let changed = false;
    for (let i = 0; i < order.length; i += 2) {
      const lower = Math.max(order[i]!, order[i + 1]!);
      if (!clashAt(lower)) continue;
      const candidates = Array.from({ length: seeds.length }, (_, k) => k + 1)
        .filter((s) => s !== lower && tierOf(s) === tierOf(lower) && opponentSeed.get(s) !== lower)
        .sort((a, b) => Math.abs(a - lower) - Math.abs(b - lower) || b - a);
      for (const s of candidates) {
        const otherClashedBefore = clashAt(s);
        swap(lower, s);
        if (!clashAt(lower) && (!clashAt(s) || otherClashedBefore)) {
          changed = true;
          break;
        }
        swap(lower, s);
      }
    }
    if (!changed) break;
  }
  return bySeed;
}

// ---------------------------------------------------------------
// Bracket generation and advancement
// ---------------------------------------------------------------

export type KoStage = "ko" | "third";

export type KoMatch = {
  stage: KoStage;
  round: number; // 1 = first round, rounds = final
  slot: number; // 0-based within the round
  p1: string | null;
  p2: string | null;
  isBye: boolean;
  /** Set for byes at generation; for played matches once confirmed. */
  winnerId: string | null;
  status: "pending" | "live" | "done";
};

export type Knockout = {
  size: number;
  rounds: number;
  qualified: number;
  third: boolean;
  matches: KoMatch[];
};

/**
 * Generates every knockout match. Byes are done at once and their player is placed in round 2.
 * A third-place match is added if requested, there are semi-finals, and no semi-final has a bye.
 */
export function generateKnockout(
  seeds: readonly SeededPlayer[],
  groupCount: number,
  thirdPlace: boolean,
): Knockout {
  const qualified = seeds.length;
  if (qualified < 2) throw new Error("Knockout needs at least 2 players");
  const size = bracketSize(qualified);
  const rounds = roundCount(size);
  const positions = placeSeeds(seeds, groupCount);
  const order = seedOrder(size);
  const matches: KoMatch[] = [];

  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let slot = 0; slot < count; slot++) {
      matches.push({ stage: "ko", round: r, slot, p1: null, p2: null, isBye: false, winnerId: null, status: "pending" });
    }
  }
  const third = thirdPlace && rounds >= 2 && !semiFinalHasBye(size, qualified);
  if (third) {
    matches.push({ stage: "third", round: rounds, slot: 0, p1: null, p2: null, isBye: false, winnerId: null, status: "pending" });
  }

  for (let slot = 0; slot < size / 2; slot++) {
    const m = findMatch(matches, "ko", 1, slot)!;
    m.p1 = positions[order[slot * 2]! - 1]?.playerId ?? null;
    m.p2 = positions[order[slot * 2 + 1]! - 1]?.playerId ?? null;
    if (m.p1 === null || m.p2 === null) {
      m.isBye = true;
      m.status = "done";
      m.winnerId = m.p1 ?? m.p2;
      if (rounds > 1 && m.winnerId) applyUpdates(matches, advanceWinner(m, m.winnerId, null, rounds));
    }
  }

  return { size, rounds, qualified, third, matches };
}

export type SlotUpdate = {
  stage: KoStage;
  round: number;
  slot: number;
  side: "p1" | "p2";
  playerId: string | null;
};

/**
 * Where a confirmed result sends its players: the winner to (r+1, slot div 2) as p1 if the
 * slot is even, else p2; a semi-final loser to the third-place match.
 */
export function advanceWinner(
  match: Pick<KoMatch, "stage" | "round" | "slot">,
  winnerId: string | null,
  loserId: string | null,
  rounds: number,
  hasThird = true,
): SlotUpdate[] {
  if (match.stage !== "ko" || match.round >= rounds) return [];
  const side = match.slot % 2 === 0 ? "p1" : "p2";
  const updates: SlotUpdate[] = [
    { stage: "ko", round: match.round + 1, slot: Math.floor(match.slot / 2), side, playerId: winnerId },
  ];
  if (hasThird && match.round === rounds - 1) {
    updates.push({ stage: "third", round: rounds, slot: 0, side, playerId: loserId });
  }
  return updates;
}

export function findMatch(
  matches: readonly KoMatch[],
  stage: KoStage,
  round: number,
  slot: number,
): KoMatch | undefined {
  return matches.find((m) => m.stage === stage && m.round === round && m.slot === slot);
}

/** Applies slot updates in place, skipping targets that don't exist (e.g. no third-place match). */
export function applyUpdates(matches: KoMatch[], updates: readonly SlotUpdate[]): void {
  for (const u of updates) {
    const target = findMatch(matches, u.stage, u.round, u.slot);
    if (target) target[u.side] = u.playerId;
  }
}

export type EditResult = { ok: true; updates: SlotUpdate[] } | { ok: false; error: "nextMatchStarted" };

/**
 * Changing the winner of a finished knockout match: rewrites the next match (and the
 * third-place match for a semi-final) only if those haven't started.
 */
export function editKnockoutWinner(
  matches: readonly KoMatch[],
  match: KoMatch,
  newWinnerId: string,
  rounds: number,
): EditResult {
  const loserId = match.p1 === newWinnerId ? match.p2 : match.p1;
  const hasThird = matches.some((m) => m.stage === "third");
  const updates = advanceWinner(match, newWinnerId, loserId, rounds, hasThird);
  for (const u of updates) {
    const target = findMatch(matches, u.stage, u.round, u.slot);
    if (target && target.status !== "pending") return { ok: false, error: "nextMatchStarted" };
  }
  return { ok: true, updates };
}
