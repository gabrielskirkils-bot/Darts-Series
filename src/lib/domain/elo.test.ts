import { describe, expect, it } from "vitest";
import {
  computeElo,
  DEFAULT_ELO,
  eloChange,
  expectedScore,
  newRating,
  placingDeltas,
  type EloMatch,
  type EloPlacement,
} from "./elo";

const match = (id: string, date: string, at: string, p1: string, p2: string, winnerId: string, extra: Partial<EloMatch> = {}): EloMatch => ({
  id,
  tournamentId: extra.tournamentId ?? `t-${date}`,
  tournamentDate: date,
  finishedAt: `${date}T${at}:00Z`,
  p1,
  p2,
  winnerId,
  ...extra,
});

/** Matches only, K 32 (the classic setup the first tests describe). */
const MATCHES_K32 = { k: 32, start: 1500, placeK: 0 };

describe("expectedScore / newRating", () => {
  it("equal ratings expect 0.5", () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
  });

  it("400 points apart expect ~0.909", () => {
    expect(expectedScore(1900, 1500)).toBeCloseTo(10 / 11);
  });

  it("winner of an even match gains K/2", () => {
    expect(newRating(1500, 1500, 1, 32)).toBe(1516);
    expect(newRating(1500, 1500, 0, 32)).toBe(1484);
  });
});

describe("computeElo: matches", () => {
  it("starts everyone at the start rating and is zero-sum", () => {
    const { ratings, history } = computeElo([match("m1", "2026-01-10", "19:00", "a", "b", "a")], MATCHES_K32);
    expect(ratings.get("a")).toBe(1516);
    expect(ratings.get("b")).toBe(1484);
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ playerId: "a", ratingBefore: 1500, ratingAfter: 1516 });
  });

  it("uses match K 16 by default", () => {
    const { ratings } = computeElo([match("m1", "2026-01-10", "19:00", "a", "b", "a")]);
    expect(DEFAULT_ELO.k).toBe(16);
    expect(ratings.get("a")).toBe(1508);
  });

  it("replays chronologically by tournament date, then finished_at", () => {
    const ms = [
      match("m3", "2026-02-01", "19:00", "a", "c", "c"),
      match("m2", "2026-01-10", "20:00", "b", "c", "b"),
      match("m1", "2026-01-10", "19:00", "a", "b", "a"),
    ];
    const { history } = computeElo(ms, MATCHES_K32);
    expect([...new Set(history.map((h) => h.matchId))]).toEqual(["m1", "m2", "m3"]);
    // Order-independent result.
    expect(computeElo([...ms].reverse(), MATCHES_K32).ratings).toEqual(computeElo(ms, MATCHES_K32).ratings);
  });

  it("skips byes and uses configured K and start", () => {
    const { ratings } = computeElo(
      [
        match("m1", "2026-01-10", "19:00", "a", "b", "a", { isBye: true }),
        match("m2", "2026-01-10", "20:00", "a", "b", "b"),
      ],
      { k: 20, start: 1000 },
    );
    expect(ratings.get("a")).toBe(990);
    expect(ratings.get("b")).toBe(1010);
  });

  it("includes fallback (manual) entries like any finished match", () => {
    const { history } = computeElo([match("m1", "2026-01-10", "19:00", "a", "b", "b")], MATCHES_K32);
    expect(history.map((h) => h.playerId)).toEqual(["a", "b"]);
  });
});

describe("placingDeltas", () => {
  it("better place = win, shared place = draw, spread over the field, zero-sum", () => {
    const places = new Map([
      ["a", 1],
      ["b", 2],
      ["c", 2],
      ["d", 4],
    ]);
    const ratings = new Map([...places.keys()].map((id) => [id, 1500]));
    const d = placingDeltas(places, ratings, 48);
    // 48 / 3 opponents = 16 per pair; at equal ratings each result is ±8.
    expect(d.get("a")).toBeCloseTo(24);
    expect(d.get("b")).toBeCloseTo(0);
    expect(d.get("c")).toBeCloseTo(0);
    expect(d.get("d")).toBeCloseTo(-24);
    expect([...d.values()].reduce((s, x) => s + x, 0)).toBeCloseTo(0);
  });

  it("nothing for fewer than two players or K 0", () => {
    expect(placingDeltas(new Map([["a", 1]]), new Map([["a", 1500]]), 48).size).toBe(0);
    expect(placingDeltas(new Map([["a", 1], ["b", 2]]), new Map([["a", 1500], ["b", 1500]]), 0).size).toBe(0);
  });
});

describe("computeElo: matches + places", () => {
  it("adds the placing step to each player's last match row, keeping history continuous", () => {
    const ms = [
      match("m1", "2026-01-10", "19:00", "a", "b", "a", { tournamentId: "t1" }),
      match("m2", "2026-01-10", "20:00", "b", "c", "b", { tournamentId: "t1" }),
      match("m3", "2026-02-10", "19:00", "a", "c", "c", { tournamentId: "t2" }),
    ];
    const places: EloPlacement[] = [
      { tournamentId: "t1", playerId: "a", place: 1 },
      { tournamentId: "t1", playerId: "b", place: 2 },
      { tournamentId: "t1", playerId: "c", place: 3 },
    ];
    const withPlaces = computeElo(ms, { k: 16, start: 1500, placeK: 48 }, places);
    const matchesOnly = computeElo(ms, { k: 16, start: 1500, placeK: 0 });

    const aRows = withPlaces.history.filter((h) => h.playerId === "a");
    // a's last t1 row now includes the placing win; the next tournament starts from it.
    expect(aRows[0]!.ratingAfter).toBeGreaterThan(matchesOnly.history.find((h) => h.playerId === "a")!.ratingAfter);
    expect(aRows[1]!.ratingBefore).toBeCloseTo(aRows[0]!.ratingAfter, 1);
    // t2 has no places, so only its match counts.
    expect(withPlaces.history).toHaveLength(matchesOnly.history.length);
    // Zero-sum overall.
    const total = [...withPlaces.ratings.values()].reduce((s, r) => s + r, 0);
    expect(total).toBeCloseTo(3 * 1500, 1);
  });

  it("Darts Series #1: a group exit ends below the players who lost their first playoff match", () => {
    const g = (id: string, at: string, p1: string, p2: string, w: string) =>
      match(id, "2026-10-03", at, p1, p2, w, { tournamentId: "ds1" });
    const ms = [
      g("g1", "15:00", "Strods", "Trapece", "Strods"),
      g("g2", "15:10", "Matiss", "Emils", "Emils"),
      g("g3", "15:20", "Gabriels", "Korts", "Korts"),
      g("g4", "15:30", "Trapece", "Elvis", "Trapece"),
      g("g5", "15:40", "Korts", "Korzans", "Korzans"),
      g("g6", "15:50", "Emils", "Helmuts", "Emils"),
      g("g7", "16:00", "Elvis", "Strods", "Strods"),
      g("g8", "16:10", "Helmuts", "Matiss", "Helmuts"),
      g("g9", "16:20", "Korzans", "Gabriels", "Korzans"),
      g("q1", "16:40", "Strods", "Matiss", "Strods"),
      g("q2", "16:50", "Korzans", "Gabriels", "Korzans"),
      g("q3", "17:00", "Emils", "Korts", "Korts"),
      g("q4", "17:10", "Trapece", "Helmuts", "Helmuts"),
      g("s1", "17:30", "Strods", "Korzans", "Strods"),
      g("s2", "17:40", "Korts", "Helmuts", "Helmuts"),
      g("f1", "18:00", "Strods", "Helmuts", "Helmuts"),
    ];
    const finalPlaces: Record<string, number> = {
      Helmuts: 1, Strods: 2, Korts: 3, Korzans: 3, Emils: 5, Gabriels: 5, Matiss: 5, Trapece: 5, Elvis: 9,
    };
    const places = Object.entries(finalPlaces).map(([playerId, place]) => ({ tournamentId: "ds1", playerId, place }));

    const before = computeElo(ms, MATCHES_K32).ratings;
    expect(before.get("Elvis")!).toBeGreaterThan(before.get("Gabriels")!); // the old problem

    const r = computeElo(ms, DEFAULT_ELO, places).ratings;
    for (const firstPlayoffLoser of ["Gabriels", "Matiss", "Emils", "Trapece"]) {
      expect(r.get("Elvis")!).toBeLessThan(r.get(firstPlayoffLoser)!);
    }
    expect(Math.round(r.get("Helmuts")!)).toBe(1547);
    expect(Math.round(r.get("Elvis")!)).toBe(1461);
    expect(Math.round(r.get("Gabriels")!)).toBe(1470);
    // Match wins still count among equal places: Emils (won his group) is well above Gabriels.
    expect(r.get("Emils")! - r.get("Gabriels")!).toBeGreaterThan(20);
  });
});

describe("eloChange", () => {
  it("is the rating after the last match minus before the first, per tournament", () => {
    const { history } = computeElo(
      [
        match("m1", "2026-01-10", "19:00", "a", "b", "a", { tournamentId: "t1" }),
        match("m2", "2026-01-10", "20:00", "a", "c", "a", { tournamentId: "t1" }),
        match("m3", "2026-02-10", "19:00", "a", "b", "b", { tournamentId: "t2" }),
      ],
      MATCHES_K32,
    );
    const t1 = eloChange(history, "a", "t1")!;
    const firstBefore = history.find((h) => h.playerId === "a")!.ratingBefore;
    const lastAfterT1 = history.filter((h) => h.playerId === "a" && h.tournamentId === "t1").at(-1)!.ratingAfter;
    expect(t1).toBeCloseTo(lastAfterT1 - firstBefore);
    expect(t1).toBeGreaterThan(0);
    expect(eloChange(history, "a", "t2")!).toBeLessThan(0);
    expect(eloChange(history, "c", "t2")).toBeNull();
  });
});
