import { describe, expect, it } from "vitest";
import { computeElo, eloChange, expectedScore, newRating, type EloMatch } from "./elo";

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

describe("computeElo", () => {
  it("starts everyone at the start rating and is zero-sum", () => {
    const { ratings, history } = computeElo([match("m1", "2026-01-10", "19:00", "a", "b", "a")]);
    expect(ratings.get("a")).toBe(1516);
    expect(ratings.get("b")).toBe(1484);
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ playerId: "a", ratingBefore: 1500, ratingAfter: 1516 });
  });

  it("replays chronologically by tournament date, then finished_at", () => {
    const ms = [
      match("m3", "2026-02-01", "19:00", "a", "c", "c"),
      match("m2", "2026-01-10", "20:00", "b", "c", "b"),
      match("m1", "2026-01-10", "19:00", "a", "b", "a"),
    ];
    const { history } = computeElo(ms);
    expect([...new Set(history.map((h) => h.matchId))]).toEqual(["m1", "m2", "m3"]);
    // Order-independent result.
    expect(computeElo([...ms].reverse()).ratings).toEqual(computeElo(ms).ratings);
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
    const { history } = computeElo([match("m1", "2026-01-10", "19:00", "a", "b", "b")]);
    expect(history.map((h) => h.playerId)).toEqual(["a", "b"]);
  });
});

describe("eloChange", () => {
  it("is the rating after the last match minus before the first, per tournament", () => {
    const { history } = computeElo([
      match("m1", "2026-01-10", "19:00", "a", "b", "a", { tournamentId: "t1" }),
      match("m2", "2026-01-10", "20:00", "a", "c", "a", { tournamentId: "t1" }),
      match("m3", "2026-02-10", "19:00", "a", "b", "b", { tournamentId: "t2" }),
    ]);
    const t1 = eloChange(history, "a", "t1")!;
    const firstBefore = history.find((h) => h.playerId === "a")!.ratingBefore;
    const lastAfterT1 = history.filter((h) => h.playerId === "a" && h.tournamentId === "t1").at(-1)!.ratingAfter;
    expect(t1).toBeCloseTo(lastAfterT1 - firstBefore);
    expect(t1).toBeGreaterThan(0);
    expect(eloChange(history, "a", "t2")!).toBeLessThan(0);
    expect(eloChange(history, "c", "t2")).toBeNull();
  });
});
