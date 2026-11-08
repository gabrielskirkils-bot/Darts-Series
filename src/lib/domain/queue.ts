// Board queue (SPEC section 4.6).

export type QueueMatch = {
  id: string;
  p1: string | null;
  p2: string | null;
  status: "pending" | "live" | "done";
  isBye: boolean;
  board: number | null;
  sortOrder: number;
};

/** Pending matches with both players, not a bye, ordered by sort_order. */
export function waitingMatches<T extends QueueMatch>(matches: readonly T[]): T[] {
  return matches
    .filter((m) => m.status === "pending" && !m.isBye && m.p1 !== null && m.p2 !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Players currently in a live match. */
export function busyPlayers(matches: readonly QueueMatch[]): Set<string> {
  const busy = new Set<string>();
  for (const m of matches) {
    if (m.status !== "live") continue;
    if (m.p1) busy.add(m.p1);
    if (m.p2) busy.add(m.p2);
  }
  return busy;
}

/** Whether a waiting match can start now (neither player is playing elsewhere). */
export function isPlayable(match: QueueMatch, busy: ReadonlySet<string>): boolean {
  return !busy.has(match.p1 ?? "") && !busy.has(match.p2 ?? "");
}

/** Next match for a free board: lowest sort_order among playable waiting matches. */
export function nextMatch<T extends QueueMatch>(matches: readonly T[]): T | null {
  const busy = busyPlayers(matches);
  return waitingMatches(matches).find((m) => isPlayable(m, busy)) ?? null;
}

/** The live match on a board, if any. */
export function liveOnBoard<T extends QueueMatch>(matches: readonly T[], board: number): T | null {
  return matches.find((m) => m.status === "live" && m.board === board) ?? null;
}

/**
 * What each board shows on the TV: its live match, or for a free board the match it would
 * play next. Free boards take waiting matches in queue order; a match handed to one board
 * is not offered to the next, and its players count as busy.
 */
export function boardAssignments<T extends QueueMatch>(
  matches: readonly T[],
  boards: number,
): { board: number; live: T | null; next: T | null }[] {
  const busy = busyPlayers(matches);
  const waiting = waitingMatches(matches);
  const taken = new Set<string>();
  return Array.from({ length: boards }, (_, i) => {
    const board = i + 1;
    const live = liveOnBoard(matches, board);
    if (live) return { board, live, next: null };
    const next = waiting.find((m) => !taken.has(m.id) && isPlayable(m, busy)) ?? null;
    if (next) {
      taken.add(next.id);
      if (next.p1) busy.add(next.p1);
      if (next.p2) busy.add(next.p2);
    }
    return { board, live: null, next };
  });
}

/** sort_order for knockout matches: after all group matches, third-place just before the final. */
export function knockoutSortOrder(
  stage: "ko" | "third",
  round: number,
  slot: number,
  rounds: number,
): number {
  const base = 10_000;
  if (stage === "third") return base + rounds * 100 - 1;
  return base + round * 100 + slot;
}
