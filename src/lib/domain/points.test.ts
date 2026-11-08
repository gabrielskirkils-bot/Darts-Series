import { describe, expect, it } from "vitest";
import {
  DEFAULT_POINTS,
  inPeriod,
  pointsForPlace,
  rankingMovement,
  rankPlayers,
  type ResultEntry,
} from "./points";

describe("pointsForPlace", () => {
  it("uses the largest row with from-place ≤ place", () => {
    const pts = (p: number) => pointsForPlace(p, DEFAULT_POINTS);
    expect([1, 2, 3, 4, 5, 8, 9, 16, 17, 32, 33, 64].map(pts)).toEqual([
      100, 75, 60, 50, 40, 40, 25, 25, 15, 15, 10, 10,
    ]);
  });

  it("works with an unsorted table and returns 0 when no row applies", () => {
    const table = [
      { place: 5, pts: 10 },
      { place: 2, pts: 20 },
    ];
    expect(pointsForPlace(1, table)).toBe(0);
    expect(pointsForPlace(3, table)).toBe(20);
    expect(pointsForPlace(7, table)).toBe(10);
  });
});

describe("inPeriod", () => {
  it("filters by year", () => {
    expect(inPeriod("2026-03-01", { kind: "all" })).toBe(true);
    expect(inPeriod("2026-03-01", { kind: "year", year: 2026 })).toBe(true);
    expect(inPeriod("2025-12-31", { kind: "year", year: 2026 })).toBe(false);
  });
});

const r = (tournamentId: string, playerId: string, place: number): ResultEntry => ({
  tournamentId,
  playerId,
  place,
  points: pointsForPlace(place, DEFAULT_POINTS),
});

describe("rankPlayers", () => {
  it("sums points, counts tournaments, wins and best finish", () => {
    const rows = rankPlayers([r("t1", "a", 1), r("t1", "b", 2), r("t2", "a", 3), r("t2", "b", 1)]);
    expect(rows[0]).toMatchObject({ playerId: "b", points: 175, tournaments: 2, wins: 1, bestFinish: 1, position: 1 });
    expect(rows[1]).toMatchObject({ playerId: "a", points: 160, tournaments: 2, wins: 1, bestFinish: 1, position: 2 });
  });

  it("equal points share a position; order by wins then average", () => {
    const results: ResultEntry[] = [
      { tournamentId: "t1", playerId: "a", place: 1, points: 50 },
      { tournamentId: "t1", playerId: "b", place: 2, points: 50 },
      { tournamentId: "t1", playerId: "c", place: 3, points: 50 },
      { tournamentId: "t1", playerId: "d", place: 4, points: 10 },
    ];
    const rows = rankPlayers(
      results,
      new Map([
        ["b", 40],
        ["c", 60],
      ]),
    );
    expect(rows.map((x) => [x.playerId, x.position])).toEqual([
      ["a", 1],
      ["c", 1],
      ["b", 1],
      ["d", 4],
    ]);
  });
});

describe("rankingMovement", () => {
  it("compares with the ranking before the last tournament", () => {
    const before = rankPlayers([r("t1", "a", 1), r("t1", "b", 2), r("t1", "c", 3)]);
    const after = rankPlayers([
      r("t1", "a", 1),
      r("t1", "b", 2),
      r("t1", "c", 3),
      r("t2", "c", 1),
      r("t2", "d", 2),
      r("t2", "b", 5),
    ]);
    // after: c 160, b 115, a 100, d 75
    const mv = rankingMovement(after, before);
    expect(mv.get("c")).toEqual({ kind: "up", by: 2 });
    expect(mv.get("b")).toEqual({ kind: "same" });
    expect(mv.get("a")).toEqual({ kind: "down", by: 2 });
    expect(mv.get("d")).toEqual({ kind: "new" });
  });
});
