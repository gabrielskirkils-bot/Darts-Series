import { describe, expect, it } from "vitest";
import {
  checkoutPercent,
  combineTotals,
  EMPTY_TOTALS,
  first9Average,
  headToHead,
  playerRecord,
  threeDartAverage,
  visitTotals,
  type RecordMatch,
  type StatVisit,
} from "./stats";

let seq = 0;
const v = (legNo: number, score: number, extra: Partial<StatVisit> = {}): StatVisit => ({
  matchId: "m1",
  legNo,
  seq: ++seq,
  score,
  darts: 3,
  dartsAtDouble: 0,
  bust: false,
  isCheckout: false,
  ...extra,
});

describe("visitTotals", () => {
  it("counts points and darts; a bust is 0 points and 3 darts", () => {
    const t = visitTotals([v(1, 60), v(1, 100), v(1, 45, { bust: true })]);
    expect(t.points).toBe(160);
    expect(t.darts).toBe(9);
    expect(threeDartAverage(t.points, t.darts)).toBeCloseTo(160 / 3);
  });

  it("checkout uses the actual darts", () => {
    const t = visitTotals([v(1, 140), v(1, 140), v(1, 140), v(1, 81, { isCheckout: true, darts: 2, dartsAtDouble: 1 })]);
    expect(t.darts).toBe(11);
    expect(t.bestLegDarts).toBe(11);
    expect(t.highestCheckout).toBe(81);
    expect(t.checkouts).toBe(1);
  });

  it("first 9 = first 3 visits of each leg", () => {
    const t = visitTotals([v(1, 100), v(1, 100), v(1, 100), v(1, 20), v(2, 60), v(2, 60)]);
    expect(t.first9Points).toBe(420);
    expect(t.first9Darts).toBe(15);
    expect(first9Average(t)).toBeCloseTo(84);
  });

  it("180 / 140+ / 100+ bands, busts excluded", () => {
    const t = visitTotals([v(1, 180), v(1, 177), v(1, 140), v(1, 139), v(1, 100), v(1, 99), v(1, 180, { bust: true })]);
    expect([t.t180, t.t140, t.t100]).toEqual([1, 2, 2]);
  });

  it("checkout % = checkouts / darts at double", () => {
    const t = visitTotals([
      v(1, 20, { dartsAtDouble: 3 }),
      v(1, 32, { isCheckout: true, darts: 2, dartsAtDouble: 2 }),
    ]);
    expect(t.dartsAtDouble).toBe(5);
    expect(checkoutPercent(t)).toBeCloseTo(20);
    expect(checkoutPercent(EMPTY_TOTALS)).toBeNull();
  });

  it("best leg = fewest darts in a won leg; lost legs don't count", () => {
    const t = visitTotals([
      v(1, 180), v(1, 180), v(1, 141, { isCheckout: true, darts: 3, dartsAtDouble: 1 }), // 9 darts
      v(2, 60), // lost leg, 3 darts
      v(3, 100), v(3, 100), v(3, 100), v(3, 100), v(3, 101, { isCheckout: true, darts: 2, dartsAtDouble: 1 }),
    ]);
    expect(t.bestLegDarts).toBe(9);
  });

  it("separates legs of different matches", () => {
    const t = visitTotals([
      v(1, 100, { matchId: "a" }),
      v(1, 100, { matchId: "b" }),
      v(1, 100, { matchId: "a" }),
      v(1, 100, { matchId: "a" }),
      v(1, 0, { matchId: "a" }),
    ]);
    expect(t.first9Points).toBe(400);
  });
});

describe("combineTotals", () => {
  it("sums counts, keeps the max checkout and the min best leg", () => {
    const a = { ...EMPTY_TOTALS, points: 300, darts: 9, highestCheckout: 80, bestLegDarts: 15, t180: 1 };
    const b = { ...EMPTY_TOTALS, points: 150, darts: 9, highestCheckout: 120, bestLegDarts: null, t180: 2 };
    const c = combineTotals([a, b]);
    expect(c).toMatchObject({ points: 450, darts: 18, highestCheckout: 120, bestLegDarts: 15, t180: 3 });
    expect(combineTotals([])).toEqual(EMPTY_TOTALS);
  });
});

describe("threeDartAverage", () => {
  it("is null without darts", () => {
    expect(threeDartAverage(0, 0)).toBeNull();
  });
});

describe("records", () => {
  const matches: RecordMatch[] = [
    { p1: "a", p2: "b", legsP1: 2, legsP2: 1, winnerId: "a" },
    { p1: "c", p2: "a", legsP1: 2, legsP2: 0, winnerId: "c" },
    { p1: "a", p2: "b", legsP1: 0, legsP2: 2, winnerId: "b" },
    { p1: "a", p2: "d", legsP1: 0, legsP2: 0, winnerId: "a", isBye: true },
  ];

  it("match and leg W–L (byes excluded)", () => {
    expect(playerRecord("a", matches)).toEqual({ matches: { won: 1, lost: 2 }, legs: { won: 2, lost: 5 } });
  });

  it("head-to-head per opponent", () => {
    const h = headToHead("a", matches);
    expect(h.get("b")).toEqual({ won: 1, lost: 1 });
    expect(h.get("c")).toEqual({ won: 0, lost: 1 });
    expect(h.has("d")).toBe(false);
  });
});
