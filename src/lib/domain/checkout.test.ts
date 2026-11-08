import { describe, expect, it } from "vitest";
import { minCheckoutDarts, suggestCheckout } from "./checkout";
import { BOGEY_NUMBERS } from "./rules";

function valueOf(label: string): number {
  if (label === "Bull") return 50;
  if (label === "25") return 25;
  const n = Number(label.slice(1));
  return label[0] === "T" ? n * 3 : label[0] === "D" ? n * 2 : n;
}

describe("suggestCheckout", () => {
  it("matches the SPEC examples", () => {
    expect(suggestCheckout(170)).toEqual(["T20", "T20", "Bull"]);
    expect(suggestCheckout(100)).toEqual(["T20", "D20"]);
    expect(suggestCheckout(40)).toEqual(["D20"]);
  });

  it("prefers the fewest darts (50 is Bull, not S10 D20)", () => {
    expect(suggestCheckout(50)).toEqual(["Bull"]);
  });

  it("uses the preferred double and the cheapest setup", () => {
    expect(suggestCheckout(60)).toEqual(["S20", "D20"]);
    expect(suggestCheckout(32)).toEqual(["D16"]);
    expect(suggestCheckout(164)).toEqual(["T20", "T18", "Bull"]);
    expect(suggestCheckout(3)).toEqual(["S1", "D1"]);
  });

  it("returns null for bogey numbers and out-of-range scores", () => {
    for (const s of [...BOGEY_NUMBERS, 0, 1, 171, 180]) expect(suggestCheckout(s)).toBeNull();
  });

  it("every route for 2–170 adds up and ends on a double or Bull", () => {
    for (let r = 2; r <= 170; r++) {
      const route = suggestCheckout(r);
      if (BOGEY_NUMBERS.has(r)) continue;
      expect(route, `route for ${r}`).not.toBeNull();
      expect(route!.length).toBeLessThanOrEqual(3);
      expect(route!.reduce((s, l) => s + valueOf(l), 0)).toBe(r);
      const last = route!.at(-1)!;
      expect(last === "Bull" || last.startsWith("D")).toBe(true);
    }
  });
});

describe("minCheckoutDarts", () => {
  it("returns the fewest darts needed", () => {
    expect(minCheckoutDarts(32)).toBe(1);
    expect(minCheckoutDarts(50)).toBe(1);
    expect(minCheckoutDarts(41)).toBe(2);
    expect(minCheckoutDarts(110)).toBe(2);
    expect(minCheckoutDarts(111)).toBe(3);
    expect(minCheckoutDarts(170)).toBe(3);
    expect(minCheckoutDarts(169)).toBeNull();
  });
});
