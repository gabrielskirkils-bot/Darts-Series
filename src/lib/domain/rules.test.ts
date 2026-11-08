import { describe, expect, it } from "vitest";
import {
  classifyVisit,
  isFinishable,
  isOneDartFinish,
  isValidVisitScore,
  legStarter,
  legsToWin,
  shouldAskDartsAtDouble,
} from "./rules";

describe("isValidVisitScore", () => {
  it("accepts 0–180 except impossible totals", () => {
    for (const s of [0, 1, 26, 60, 100, 140, 162, 170, 171, 174, 177, 180]) {
      expect(isValidVisitScore(s)).toBe(true);
    }
  });

  it("rejects impossible 3-dart totals (incl. 179)", () => {
    for (const s of [163, 166, 169, 172, 173, 175, 176, 178, 179]) {
      expect(isValidVisitScore(s)).toBe(false);
    }
  });

  it("rejects out-of-range and non-integer values", () => {
    for (const s of [-1, 181, 200, 12.5, Number.NaN]) expect(isValidVisitScore(s)).toBe(false);
  });
});

describe("isFinishable", () => {
  it("allows 2–170 except bogey numbers", () => {
    expect(isFinishable(2)).toBe(true);
    expect(isFinishable(170)).toBe(true);
    expect(isFinishable(161)).toBe(true);
    expect(isFinishable(164)).toBe(true);
    expect(isFinishable(167)).toBe(true);
    for (const s of [159, 162, 163, 165, 166, 168, 169]) expect(isFinishable(s)).toBe(false);
  });

  it("rejects 0, 1 and anything above 170", () => {
    for (const s of [0, 1, 171, 180, 501]) expect(isFinishable(s)).toBe(false);
  });
});

describe("isOneDartFinish", () => {
  it("is true for doubles and bull", () => {
    expect(isOneDartFinish(40)).toBe(true);
    expect(isOneDartFinish(2)).toBe(true);
    expect(isOneDartFinish(50)).toBe(true);
    expect(isOneDartFinish(41)).toBe(false);
    expect(isOneDartFinish(42)).toBe(false);
  });
});

describe("classifyVisit (SPEC 8.3, 8.4)", () => {
  it("on 32: 32 is a checkout, 31 busts (leaves 1), 33 busts", () => {
    expect(classifyVisit(32, 32)).toEqual({ kind: "checkout" });
    expect(classifyVisit(32, 31)).toEqual({ kind: "bust" });
    expect(classifyVisit(32, 33)).toEqual({ kind: "bust" });
  });

  it("179 is an impossible score", () => {
    expect(classifyVisit(501, 179)).toEqual({ kind: "invalid" });
  });

  it("normal visit reduces the remaining score", () => {
    expect(classifyVisit(501, 180)).toEqual({ kind: "ok", remaining: 321 });
    expect(classifyVisit(32, 0)).toEqual({ kind: "ok", remaining: 32 });
    expect(classifyVisit(32, 30)).toEqual({ kind: "ok", remaining: 2 });
  });

  it("refuses a checkout from a bogey or > 170", () => {
    expect(classifyVisit(159, 159)).toEqual({ kind: "cantCheckout", remaining: 159 });
    expect(classifyVisit(180, 180)).toEqual({ kind: "cantCheckout", remaining: 180 });
  });

  it("allows the 170 maximum checkout", () => {
    expect(classifyVisit(170, 170)).toEqual({ kind: "checkout" });
  });

  it("validity is checked before bust", () => {
    expect(classifyVisit(100, 179)).toEqual({ kind: "invalid" });
  });
});

describe("legsToWin / legStarter", () => {
  it("first to ceil(bestOf / 2)", () => {
    expect(legsToWin(1)).toBe(1);
    expect(legsToWin(3)).toBe(2);
    expect(legsToWin(5)).toBe(3);
    expect(legsToWin(9)).toBe(5);
  });

  it("legs alternate the starter", () => {
    expect([1, 2, 3, 4].map((l) => legStarter(0, l))).toEqual([0, 1, 0, 1]);
    expect([1, 2, 3, 4].map((l) => legStarter(1, l))).toEqual([1, 0, 1, 0]);
  });
});

describe("shouldAskDartsAtDouble", () => {
  it("asks on ≤ 50 for non-checkout visits", () => {
    expect(shouldAskDartsAtDouble(32, classifyVisit(32, 16), true)).toBe(true);
    expect(shouldAskDartsAtDouble(32, classifyVisit(32, 33), true)).toBe(true);
    expect(shouldAskDartsAtDouble(50, classifyVisit(50, 10), true)).toBe(true);
  });

  it("does not ask above 50, on a checkout, or when turned off", () => {
    expect(shouldAskDartsAtDouble(51, classifyVisit(51, 11), true)).toBe(false);
    expect(shouldAskDartsAtDouble(32, classifyVisit(32, 32), true)).toBe(false);
    expect(shouldAskDartsAtDouble(32, classifyVisit(32, 16), false)).toBe(false);
  });
});
