// Final places (SPEC section 4.9).

import type { StandingRow } from "./groups";
import type { KoMatch } from "./bracket";

export type Placement = { playerId: string; place: number };

/** Round robin: place = table position. */
export function roundRobinPlaces(table: readonly StandingRow[]): Placement[] {
  return table.map((r) => ({ playerId: r.playerId, place: r.position }));
}

/**
 * Knockout places. Final: 1 and 2. Third-place match: 3 and 4; without it both semi-final
 * losers share 3. A loser in the round k-th from the end gets 2^(k−1) + 1.
 * Every non-bye knockout match must be done.
 */
export function knockoutPlaces(matches: readonly KoMatch[], rounds: number): Placement[] {
  const places: Placement[] = [];
  const third = matches.find((m) => m.stage === "third");

  for (const m of matches) {
    if (m.isBye || m.status !== "done" || !m.winnerId) continue;
    const loser = m.winnerId === m.p1 ? m.p2 : m.p1;
    if (m.stage === "third") {
      places.push({ playerId: m.winnerId, place: 3 });
      if (loser) places.push({ playerId: loser, place: 4 });
      continue;
    }
    const k = rounds - m.round + 1;
    if (k === 1) places.push({ playerId: m.winnerId, place: 1 });
    if (!loser) continue;
    if (k === 2 && third) continue; // semi-final losers are placed by the third-place match
    places.push({ playerId: loser, place: k === 1 ? 2 : 2 ** (k - 1) + 1 });
  }
  return places.sort((a, b) => a.place - b.place);
}

/**
 * Players eliminated in the groups. Everyone with the same group position shares a place,
 * starting at qualified + 1; each later position starts after all players of the one before.
 */
export function groupEliminatedPlaces(
  tables: readonly (readonly StandingRow[])[],
  advance: number,
): Placement[] {
  const qualified = tables.reduce(
    (sum, rows) => sum + rows.filter((r) => r.position <= advance).length,
    0,
  );
  const maxPos = Math.max(0, ...tables.map((rows) => rows.length));
  const places: Placement[] = [];
  let next = qualified + 1;
  for (let pos = advance + 1; pos <= maxPos; pos++) {
    const atPos = tables.flatMap((rows) => rows.filter((r) => r.position === pos));
    for (const r of atPos) places.push({ playerId: r.playerId, place: next });
    next += atPos.length;
  }
  return places;
}

/**
 * Players who never reached the knockout, by group position: everyone at the same position
 * shares a place, starting after all knockout players. Unlike groupEliminatedPlaces this
 * reads who actually qualified, so it also fits brackets filled with the best third-placed
 * players (e.g. 3 groups of 3 → top 2 + 2 best thirds = 8).
 */
export function nonQualifiedPlaces(
  tables: readonly (readonly StandingRow[])[],
  qualified: ReadonlySet<string>,
): Placement[] {
  const maxPos = Math.max(0, ...tables.map((rows) => rows.length));
  const places: Placement[] = [];
  let next = qualified.size + 1;
  for (let pos = 1; pos <= maxPos; pos++) {
    const atPos = tables.flatMap((rows) => rows.filter((r) => r.position === pos && !qualified.has(r.playerId)));
    for (const r of atPos) places.push({ playerId: r.playerId, place: next });
    next += atPos.length;
  }
  return places;
}

/** Every player's place for a finished groups + knockout tournament. */
export function groupsKnockoutPlaces(
  tables: readonly (readonly StandingRow[])[],
  advance: number,
  koMatches: readonly KoMatch[],
  rounds: number,
): Placement[] {
  // Who played the knockout: everyone in a first-round slot (byes included).
  const qualified = new Set<string>();
  for (const m of koMatches) {
    if (m.stage !== "ko" || m.round !== 1) continue;
    if (m.p1) qualified.add(m.p1);
    if (m.p2) qualified.add(m.p2);
  }
  if (qualified.size === 0) return [...knockoutPlaces(koMatches, rounds), ...groupEliminatedPlaces(tables, advance)];
  return [...knockoutPlaces(koMatches, rounds), ...nonQualifiedPlaces(tables, qualified)];
}
