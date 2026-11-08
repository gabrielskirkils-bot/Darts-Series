import { describe, expect, it } from "vitest";
import {
  buildVisit,
  lastVisit,
  legHistory,
  manualResultWinner,
  matchState,
  matchSummary,
  mergeVisits,
  planVisit,
  type MatchSetup,
  type Visit,
} from "./match";

describe("manualResultWinner (fallback entry)", () => {
  it("accepts finished best-of results", () => {
    expect(manualResultWinner(5, 3, 1)).toBe(0);
    expect(manualResultWinner(5, 2, 3)).toBe(1);
    expect(manualResultWinner(3, 0, 2)).toBe(1);
    expect(manualResultWinner(1, 1, 0)).toBe(0);
  });

  it("rejects unfinished, overlong or invalid scores", () => {
    expect(manualResultWinner(5, 2, 1)).toBeNull();
    expect(manualResultWinner(5, 3, 3)).toBeNull();
    expect(manualResultWinner(5, 4, 0)).toBeNull();
    expect(manualResultWinner(3, -1, 2)).toBeNull();
    expect(manualResultWinner(3, 2, 1.5)).toBeNull();
  });
});

const setup: MatchSetup = { startScore: 301, bestOf: 3, firstStarter: 0 };

/** Plays visit totals in order; checkouts use the given darts (default 3, 1 at double). */
function play(s: MatchSetup, scores: (number | { score: number; darts: number; dartsAtDouble: number })[]) {
  const visits: Visit[] = [];
  for (const entry of scores) {
    const state = matchState(s, visits);
    const input = typeof entry === "number" ? { score: entry } : entry;
    visits.push(buildVisit(state, input));
  }
  return visits;
}

describe("matchState", () => {
  it("starts with full scores and the leg-1 starter to throw", () => {
    const st = matchState(setup, []);
    expect(st.remaining).toEqual([301, 301]);
    expect(st.toThrow).toBe(0);
    expect(st.currentLeg.legNo).toBe(1);
    expect(st.winner).toBeNull();
  });

  it("alternates throws and tracks remaining and darts", () => {
    const st = matchState(setup, play(setup, [100, 60, 41]));
    expect(st.remaining).toEqual([160, 241]);
    expect(st.dartsThisLeg).toEqual([6, 3]);
    expect(st.toThrow).toBe(1);
  });

  it("a bust scores nothing but uses 3 darts", () => {
    const visits = play(setup, [140, 100, 140, 100]); // p1 on 21
    const v = buildVisit(matchState(setup, visits), { score: 20 }); // leaves 1 → bust
    expect(v.bust).toBe(true);
    const st = matchState(setup, [...visits, v]);
    expect(st.remaining[0]).toBe(21);
    expect(st.dartsThisLeg[0]).toBe(9);
  });

  it("a checkout wins the leg and the other player starts the next leg", () => {
    const visits = play(setup, [180, 100, { score: 121, darts: 3, dartsAtDouble: 1 }]);
    const st = matchState(setup, visits);
    expect(st.legsWon).toEqual([1, 0]);
    expect(st.legs[0]!.winner).toBe(0);
    expect(st.currentLeg.legNo).toBe(2);
    expect(st.currentLeg.starter).toBe(1);
    expect(st.toThrow).toBe(1);
    expect(st.remaining).toEqual([301, 301]);
  });

  it("the match ends at ceil(bestOf / 2) legs", () => {
    const visits = play(setup, [
      180, 100, { score: 121, darts: 3, dartsAtDouble: 1 }, // leg 1 → p1
      180, 100, { score: 121, darts: 3, dartsAtDouble: 2 }, // leg 2 (p2 starts) → p2
      180, 100, { score: 121, darts: 3, dartsAtDouble: 1 }, // leg 3 (p1 starts) → p1
    ]);
    const st = matchState(setup, visits);
    expect(st.legsWon).toEqual([2, 1]);
    expect(st.winner).toBe(0);
    expect(st.currentLeg.legNo).toBe(3);
    expect(planVisit(st, 60, true)).toEqual({ kind: "matchOver" });
  });

  it("undoing a checkout reopens the leg and restores the remaining score (SPEC 8.5)", () => {
    const visits = play(setup, [180, 100, { score: 121, darts: 3, dartsAtDouble: 1 }]);
    const undone = visits.filter((v) => v !== lastVisit(visits));
    const st = matchState(setup, undone);
    expect(st.currentLeg.legNo).toBe(1);
    expect(st.currentLeg.winner).toBeNull();
    expect(st.legsWon).toEqual([0, 0]);
    expect(st.remaining).toEqual([121, 201]);
    expect(st.toThrow).toBe(0);
  });

  it("ignores input order of visits", () => {
    const visits = play(setup, [100, 60, 41, 45]);
    expect(matchState(setup, [...visits].reverse())).toEqual(matchState(setup, visits));
  });
});

describe("planVisit", () => {
  const on32 = () => matchState(setup, play(setup, [180, 100, 89, 100])); // p1 on 32

  it("on 32: 32 asks for darts, 31 and 33 bust (SPEC 8.3)", () => {
    const st = on32();
    expect(st.remaining[0]).toBe(32);
    expect(planVisit(st, 32, true)).toEqual({ kind: "checkout", minDarts: 1 });
    expect(planVisit(st, 31, true)).toEqual({ kind: "save", bust: true, askDoubles: true });
    expect(planVisit(st, 33, true)).toEqual({ kind: "save", bust: true, askDoubles: true });
  });

  it("179 is invalid (SPEC 8.4)", () => {
    expect(planVisit(matchState(setup, []), 179, true)).toEqual({ kind: "invalid" });
  });

  it("asks darts at double only at ≤ 50 and when enabled", () => {
    expect(planVisit(matchState(setup, []), 60, true)).toEqual({ kind: "save", bust: false, askDoubles: false });
    expect(planVisit(on32(), 16, false)).toEqual({ kind: "save", bust: false, askDoubles: false });
  });

  it("can't check out from a bogey number", () => {
    const st = matchState({ ...setup, startScore: 501 }, play({ ...setup, startScore: 501 }, [180, 0, 162, 0]));
    expect(st.remaining[0]).toBe(159);
    expect(planVisit(st, 159, true)).toEqual({ kind: "cantCheckout", remaining: 159 });
  });

  it("minimum darts for a checkout follow the route", () => {
    const st = matchState(setup, play(setup, [100, 0, 100, 0])); // p1 on 101
    expect(st.remaining[0]).toBe(101);
    expect(planVisit(st, 101, true)).toEqual({ kind: "checkout", minDarts: 2 });
  });
});

describe("legHistory / matchSummary", () => {
  it("lists the leg in play with the score left after each visit", () => {
    const visits = play(setup, [100, 60, 180, 26]); // p1: 201 → 21 (bust check: 180 ok)
    const rows = legHistory(setup, matchState(setup, visits));
    expect(rows.map((r) => [r.player, r.score, r.remainingAfter])).toEqual([
      [0, 100, 201],
      [1, 60, 241],
      [0, 180, 21],
      [1, 26, 215],
    ]);
  });

  it("a bust keeps the score; a new leg starts an empty history", () => {
    const visits = play(setup, [140, 100, 140, 100, 20]); // p1 on 21, 20 → bust
    const rows = legHistory(setup, matchState(setup, visits));
    expect(rows.at(-1)).toMatchObject({ bust: true, remainingAfter: 21 });
    const won = play(setup, [180, 100, { score: 121, darts: 3, dartsAtDouble: 1 }]);
    expect(legHistory(setup, matchState(setup, won))).toEqual([]);
  });

  it("summarises average, 180s and checkouts per player", () => {
    const visits = play(setup, [180, 100, { score: 121, darts: 3, dartsAtDouble: 1 }]);
    const [a, b] = matchSummary(visits);
    expect(a).toEqual({ average: (301 / 6) * 3, t180: 1, highestCheckout: 121, checkouts: 1, dartsAtDouble: 1 });
    expect(b).toEqual({ average: 100, t180: 0, highestCheckout: 0, checkouts: 0, dartsAtDouble: 0 });
    expect(matchSummary([])[0].average).toBeNull();
  });
});

describe("mergeVisits (optimistic writes)", () => {
  const visits = play(setup, [100, 60, 41]);
  const [v1, v2, v3] = visits as [Visit, Visit, Visit];

  it("adds unsent visits without doubling ones the server already has", () => {
    expect(mergeVisits([v1], [{ kind: "add", visit: v2 }])).toEqual([v1, v2]);
    expect(mergeVisits([v1, v2], [{ kind: "add", visit: v2 }])).toEqual([v1, v2]);
  });

  it("an undo removes its own visit once, even if replayed", () => {
    const undo = { kind: "undo" as const, legNo: v3.legNo, seq: v3.seq };
    expect(mergeVisits(visits, [undo])).toEqual([v1, v2]);
    expect(mergeVisits([v1, v2], [undo])).toEqual([v1, v2]);
  });

  it("replays add then undo in order and sorts the result", () => {
    const ops = [
      { kind: "add" as const, visit: v3 },
      { kind: "undo" as const, legNo: v3.legNo, seq: v3.seq },
    ];
    expect(mergeVisits([v2, v1], ops)).toEqual([v1, v2]);
  });
});

describe("buildVisit", () => {
  it("numbers visits within the leg", () => {
    const visits = play(setup, [100, 60]);
    expect(visits.map((v) => [v.legNo, v.seq, v.player])).toEqual([
      [1, 1, 0],
      [1, 2, 1],
    ]);
  });

  it("validates checkout darts", () => {
    const st = matchState(setup, play(setup, [180, 100, 89, 100])); // p1 on 32
    expect(() => buildVisit(st, { score: 32, darts: 3, dartsAtDouble: 4 })).toThrow();
    expect(() => buildVisit(st, { score: 32, darts: 0, dartsAtDouble: 0 })).toThrow();
    const v = buildVisit(st, { score: 32, darts: 2, dartsAtDouble: 2 });
    expect(v).toMatchObject({ isCheckout: true, darts: 2, dartsAtDouble: 2, bust: false });
  });

  it("rejects darts below the minimum for the checkout", () => {
    const st = matchState(setup, play(setup, [100, 0, 100, 0])); // p1 on 101 (2 darts min)
    expect(() => buildVisit(st, { score: 101, darts: 1, dartsAtDouble: 1 })).toThrow();
  });

  it("rejects invalid totals", () => {
    expect(() => buildVisit(matchState(setup, []), { score: 179 })).toThrow();
  });
});
