import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORMATS,
  expectedLegs,
  matchMinutes,
  previewStructure,
  qualifiedCount,
  suggestStructure,
  validateStructure,
  type Structure,
} from "./structure";

describe("suggestStructure", () => {
  it("2–3 players: round robin", () => {
    expect(suggestStructure(2).format).toBe("rr");
    expect(suggestStructure(3).format).toBe("rr");
  });

  it("4–5 players: one group, top 2 (final)", () => {
    expect(suggestStructure(4)).toMatchObject({ format: "groups_ko", groupCount: 1, advance: 2 });
    expect(suggestStructure(5)).toMatchObject({ format: "groups_ko", groupCount: 1, advance: 2 });
  });

  it("≥ 6 players: G = max(2, round(n / 4)), top 2", () => {
    expect(suggestStructure(6).groupCount).toBe(2);
    expect(suggestStructure(8).groupCount).toBe(2);
    expect(suggestStructure(11).groupCount).toBe(3);
    expect(suggestStructure(16).groupCount).toBe(4);
    expect(suggestStructure(32).groupCount).toBe(8);
    expect(suggestStructure(32).advance).toBe(2);
  });
});

describe("previewStructure", () => {
  it("11 players: 3 groups (4, 4, 3), top 2, quarter-finals with 2 byes (SPEC 8.1)", () => {
    const p = previewStructure(11, suggestStructure(11), DEFAULT_FORMATS, 2);
    expect([...p.groupSizes].sort((a, b) => b - a)).toEqual([4, 4, 3]);
    expect(p.qualified).toBe(6);
    expect(p.bracketSize).toBe(8);
    expect(p.rounds).toBe(3);
    expect(p.byes).toBe(2);
    expect(p.groupMatches).toBe(6 + 6 + 3);
    expect(p.knockoutMatches).toBe(5);
    expect(p.totalMatches).toBe(20);
    expect(p.totalMinutes).toBeGreaterThan(0);
  });

  it("computes the duration per the SPEC formula", () => {
    // 4 players, 1 group, top 2 → 6 group matches + final, 2 boards.
    const s: Structure = { format: "groups_ko", groupCount: 1, advance: 2, thirdPlace: false };
    const p = previewStructure(4, s, DEFAULT_FORMATS, 2);
    const group = (6 * matchMinutes(DEFAULT_FORMATS.group)) / 2;
    const final = matchMinutes(DEFAULT_FORMATS.final);
    expect(p.groupMinutes).toBe(Math.round(group));
    expect(p.knockoutMinutes).toBe(Math.round(final));
    expect(p.totalMinutes).toBe(Math.round(group + final));
  });

  it("knockout rounds use ceil(matches / boards)", () => {
    const s: Structure = { format: "ko", groupCount: 1, advance: 0, thirdPlace: false };
    const p = previewStructure(8, s, DEFAULT_FORMATS, 3);
    const ko = matchMinutes(DEFAULT_FORMATS.ko);
    // QF: 4 matches on 3 boards = 2 slots; SF: 2 matches = 1 slot; final.
    expect(p.knockoutMinutes).toBe(Math.round(2 * ko + 1 * ko + matchMinutes(DEFAULT_FORMATS.final)));
    expect(p.groupMatches).toBe(0);
    expect(p.knockoutMatches).toBe(7);
  });

  it("adds a third-place match only when no semi-final has a bye", () => {
    const withThird: Structure = { format: "ko", groupCount: 1, advance: 0, thirdPlace: true };
    expect(previewStructure(4, withThird, DEFAULT_FORMATS, 2).hasThirdPlace).toBe(true);
    expect(previewStructure(4, withThird, DEFAULT_FORMATS, 2).knockoutMatches).toBe(4);
    expect(previewStructure(3, withThird, DEFAULT_FORMATS, 2).hasThirdPlace).toBe(false);
    expect(previewStructure(2, withThird, DEFAULT_FORMATS, 2).hasThirdPlace).toBe(false);
  });

  it("round robin has no knockout", () => {
    const p = previewStructure(3, suggestStructure(3), DEFAULT_FORMATS, 1);
    expect(p.groupSizes).toEqual([3]);
    expect(p.qualified).toBe(0);
    expect(p.knockoutMatches).toBe(0);
    expect(p.totalMatches).toBe(3);
  });
});

describe("expectedLegs / matchMinutes", () => {
  it("bo1 = 1 leg, otherwise (k+1)/2 + (k−1)/2 × 0.6", () => {
    expect(expectedLegs(1)).toBe(1);
    expect(expectedLegs(3)).toBeCloseTo(2.6);
    expect(expectedLegs(5)).toBeCloseTo(4.2);
  });

  it("minutes = legs × min/leg + 1.5", () => {
    expect(matchMinutes({ start: 301, bestOf: 1 })).toBeCloseTo(6);
    expect(matchMinutes({ start: 501, bestOf: 3 })).toBeCloseTo(2.6 * 7 + 1.5);
    expect(matchMinutes({ start: 701, bestOf: 1 })).toBeCloseTo(11.5);
  });
});

describe("validateStructure", () => {
  const gko = (groupCount: number, advance: number): Structure => ({
    format: "groups_ko",
    groupCount,
    advance,
    thirdPlace: false,
  });

  it("accepts the suggestion", () => {
    for (const n of [2, 3, 4, 5, 6, 11, 17, 32]) {
      expect(validateStructure(n, suggestStructure(n))).toEqual([]);
    }
  });

  it("needs at least 2 players", () => {
    expect(validateStructure(1, suggestStructure(1))).toEqual(["tooFewPlayers"]);
  });

  it("each group needs ≥ 2 players", () => {
    expect(validateStructure(5, gko(3, 1))).toContain("groupTooSmall");
  });

  it("qualifiers can't exceed the smallest group", () => {
    expect(validateStructure(11, gko(3, 4))).toContain("advanceTooHigh");
    expect(validateStructure(11, gko(3, 3))).toEqual([]);
  });

  it("knockout needs ≥ 2 players", () => {
    expect(validateStructure(4, gko(1, 1))).toContain("knockoutTooSmall");
  });

  it("qualifiers per group are 1–4", () => {
    expect(validateStructure(20, gko(2, 5))).toContain("advanceOutOfRange");
  });
});

describe("qualifiedCount", () => {
  it("is G × A for groups, n for knockout only, 0 for round robin", () => {
    expect(qualifiedCount(11, suggestStructure(11))).toBe(6);
    expect(qualifiedCount(9, { format: "ko", groupCount: 1, advance: 0, thirdPlace: false })).toBe(9);
    expect(qualifiedCount(3, suggestStructure(3))).toBe(0);
  });
});
