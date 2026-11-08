import { describe, expect, it } from "vitest";
import {
  groupStandings,
  orderEntrants,
  roundRobinRounds,
  scheduleGroupMatches,
  snakeDraw,
  snakeGroupIndex,
  snakeGroupSizes,
  type ResultMatch,
} from "./groups";

describe("orderEntrants", () => {
  const players = [
    { id: "a", elo: 1500 },
    { id: "b", elo: 1620 },
    { id: "c", elo: 1500 },
    { id: "d", elo: 1410 },
  ];

  it("sorts by Elo descending, ties keep input order", () => {
    expect(orderEntrants(players, "elo", Math.random).map((p) => p.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("shuffles with the given RNG and keeps every player", () => {
    const rng = () => 0; // Fisher–Yates always swapping with index 0
    const out = orderEntrants(players, "random", rng).map((p) => p.id);
    expect([...out].sort()).toEqual(["a", "b", "c", "d"]);
    expect(out).toEqual(["b", "c", "d", "a"]);
  });
});

describe("snake draw", () => {
  it("follows row = i div G; even rows left→right, odd rows right→left", () => {
    expect(Array.from({ length: 9 }, (_, i) => snakeGroupIndex(i, 3))).toEqual([0, 1, 2, 2, 1, 0, 0, 1, 2]);
  });

  it("11 players into 3 groups gives sizes 3, 4, 4", () => {
    expect(snakeGroupSizes(11, 3)).toEqual([3, 4, 4]);
    const groups = snakeDraw(Array.from({ length: 11 }, (_, i) => i + 1), 3);
    expect(groups).toEqual([
      [1, 6, 7],
      [2, 5, 8, 11],
      [3, 4, 9, 10],
    ]);
  });

  it("group A holds the top seed", () => {
    expect(snakeDraw(["s1", "s2", "s3", "s4"], 2)[0]![0]).toBe("s1");
  });
});

describe("roundRobinRounds", () => {
  function checkComplete(size: number) {
    const rounds = roundRobinRounds(size);
    const seen = new Set<string>();
    for (const round of rounds) {
      const inRound = new Set<number>();
      for (const [a, b] of round) {
        expect(inRound.has(a) || inRound.has(b)).toBe(false); // nobody plays twice in a round
        inRound.add(a);
        inRound.add(b);
        seen.add([a, b].sort().join("-"));
      }
    }
    expect(seen.size).toBe((size * (size - 1)) / 2);
    return rounds;
  }

  it("even count: n − 1 rounds, every pair once", () => {
    expect(checkComplete(4)).toHaveLength(3);
    expect(checkComplete(6)).toHaveLength(5);
  });

  it("odd count: adds a dummy (n rounds, one player sits out each round)", () => {
    const rounds = checkComplete(5);
    expect(rounds).toHaveLength(5);
    expect(rounds.every((r) => r.length === 2)).toBe(true);
    expect(checkComplete(3)).toHaveLength(3);
  });

  it("handles tiny groups", () => {
    expect(roundRobinRounds(1)).toEqual([]);
    expect(checkComplete(2)).toHaveLength(1);
  });
});

describe("scheduleGroupMatches", () => {
  it("interleaves rounds across groups and numbers sort_order", () => {
    const plan = scheduleGroupMatches([
      ["a1", "a2", "a3", "a4"],
      ["b1", "b2", "b3"],
    ]);
    expect(plan).toHaveLength(6 + 3);
    expect(plan.map((m) => m.sortOrder)).toEqual(plan.map((_, i) => i));
    // Round 1 of A (2 matches), then round 1 of B (1 match), then round 2 …
    expect(plan.slice(0, 3).map((m) => [m.groupIndex, m.round])).toEqual([
      [0, 1],
      [0, 1],
      [1, 1],
    ]);
    const rounds = plan.map((m) => m.round);
    expect(rounds).toEqual([...rounds].sort((a, b) => a - b));
  });

  it("only pairs players of the same group", () => {
    const plan = scheduleGroupMatches([
      ["a1", "a2", "a3"],
      ["b1", "b2", "b3"],
      ["c1", "c2"],
    ]);
    for (const m of plan) expect(m.p1[0]).toBe(m.p2[0]);
    expect(plan).toHaveLength(3 + 3 + 1);
  });
});

describe("groupStandings", () => {
  const m = (p1: string, p2: string, l1: number, l2: number): ResultMatch => ({
    p1,
    p2,
    legsP1: l1,
    legsP2: l2,
    winnerId: l1 > l2 ? p1 : p2,
  });

  it("orders by wins, then leg difference", () => {
    // a: W3 6–1; b: W2 4–4; c: W1 4–5; d: W0 2–6
    const table = groupStandings(
      ["a", "b", "c", "d"],
      [m("a", "b", 2, 0), m("c", "d", 2, 1), m("a", "c", 2, 1), m("b", "d", 2, 1), m("a", "d", 2, 0), m("b", "c", 2, 1)],
    );
    expect(table.map((r) => r.playerId)).toEqual(["a", "b", "c", "d"]);
    expect(table[0]).toMatchObject({ played: 3, wins: 3, losses: 0, legsWon: 6, legsLost: 1, legDiff: 5, position: 1 });
    expect(table[1]).toMatchObject({ wins: 2, legDiff: 0 });
  });

  it("legs won breaks a tie on wins and leg difference", () => {
    // p: W1 3–2 (+1) and q: W1 2–1 (+1) → p has more legs won.
    // x: W0 2–3 (−1) and y: W0 1–2 (−1) → x has more legs won.
    const table = groupStandings(["q", "p", "y", "x"], [m("p", "x", 3, 2), m("q", "y", 2, 1)]);
    expect(table.map((r) => r.playerId)).toEqual(["p", "q", "x", "y"]);
  });

  it("exactly two tied: head-to-head decides, even against a better average", () => {
    // a: W2 5–3 (+2); b: W2 5–3 (+2), b beat a; c: W2 4–3 (+1); d: W0
    const table = groupStandings(
      ["a", "b", "c", "d"],
      [m("a", "b", 1, 2), m("a", "c", 2, 0), m("b", "d", 2, 0), m("c", "d", 2, 0), m("a", "d", 2, 1), m("b", "c", 1, 2)],
      new Map([
        ["a", 99],
        ["b", 10],
      ]),
    );
    expect(table.map((r) => r.playerId)).toEqual(["b", "a", "c", "d"]);
  });

  it("two tied without a played match between them: average decides", () => {
    const table = groupStandings(
      ["a", "b", "c"],
      [m("a", "c", 2, 0), m("b", "c", 2, 0)],
      new Map([
        ["a", 40],
        ["b", 60],
      ]),
    );
    expect(table.map((r) => r.playerId)).toEqual(["b", "a", "c"]);
  });

  it("three or more tied: 3-dart average decides", () => {
    const table = groupStandings(
      ["a", "b", "c"],
      [m("a", "b", 2, 1), m("b", "c", 2, 1), m("c", "a", 2, 1)],
      new Map([
        ["a", 50],
        ["b", 70],
        ["c", 60],
      ]),
    );
    expect(table.map((r) => r.playerId)).toEqual(["b", "c", "a"]);
  });

  it("lists players without results in seed order", () => {
    const table = groupStandings(["s1", "s2", "s3"], []);
    expect(table.map((r) => [r.playerId, r.position, r.played])).toEqual([
      ["s1", 1, 0],
      ["s2", 2, 0],
      ["s3", 3, 0],
    ]);
  });
});
