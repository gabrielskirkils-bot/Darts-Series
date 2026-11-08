import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings, validateSettings, type AppSettings } from "./settings";

// The JSON default from supabase/migrations/0001_init.sql.
const dbDefault = {
  points: [
    { place: 1, pts: 100 },
    { place: 2, pts: 75 },
    { place: 3, pts: 60 },
    { place: 4, pts: 50 },
    { place: 5, pts: 40 },
    { place: 9, pts: 25 },
    { place: 17, pts: 15 },
    { place: 33, pts: 10 },
  ],
  eloK: 32,
  eloStart: 1500,
  boards: 2,
  askDoubles: true,
  fmt: {
    group: { start: 301, bestOf: 3 },
    ko: { start: 501, bestOf: 5 },
    final: { start: 501, bestOf: 7 },
  },
};

describe("parseSettings", () => {
  it("reads the original database default (match K 32, no placing K → default placing K)", () => {
    // 0001 predates the placing step: it stores eloK 32 and no eloPlaceK.
    expect(parseSettings(dbDefault)).toEqual({ ...DEFAULT_SETTINGS, eloK: 32 });
  });

  it("fills missing or malformed fields with defaults", () => {
    const s = parseSettings({ eloK: "x", boards: 3, fmt: { ko: { start: 701 } }, points: [{ place: 1 }] });
    expect(s.eloK).toBe(DEFAULT_SETTINGS.eloK);
    expect(s.eloPlaceK).toBe(48);
    expect(s.boards).toBe(3);
    expect(s.fmt.ko).toEqual({ start: 701, bestOf: 5 });
    expect(s.fmt.group).toEqual({ start: 301, bestOf: 3 });
    expect(s.points).toEqual(DEFAULT_SETTINGS.points);
  });

  it("handles null / non-objects", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings([1, 2])).toEqual(DEFAULT_SETTINGS);
  });

  it("sorts points rows by place", () => {
    const s = parseSettings({ points: [{ place: 5, pts: 1 }, { place: 1, pts: 9 }] });
    expect(s.points.map((r) => r.place)).toEqual([1, 5]);
  });
});

describe("validateSettings", () => {
  const ok = (): AppSettings => structuredClone(DEFAULT_SETTINGS);

  it("accepts the defaults", () => {
    expect(validateSettings(ok())).toEqual([]);
  });

  it("checks the points table", () => {
    expect(validateSettings({ ...ok(), points: [] })).toEqual(["pointsEmpty"]);
    expect(validateSettings({ ...ok(), points: [{ place: 0, pts: 5 }] })).toContain("placeInvalid");
    expect(validateSettings({ ...ok(), points: [{ place: 1.5, pts: 5 }] })).toContain("placeInvalid");
    expect(
      validateSettings({
        ...ok(),
        points: [
          { place: 1, pts: 5 },
          { place: 1, pts: 3 },
        ],
      }),
    ).toContain("placeDuplicate");
    expect(validateSettings({ ...ok(), points: [{ place: 1, pts: -1 }] })).toContain("ptsInvalid");
    const many = Array.from({ length: 31 }, (_, i) => ({ place: i + 1, pts: 1 }));
    expect(validateSettings({ ...ok(), points: many })).toContain("pointsTooMany");
  });

  it("checks Elo and boards ranges", () => {
    expect(validateSettings({ ...ok(), eloK: 0 })).toEqual(["eloKInvalid"]);
    expect(validateSettings({ ...ok(), eloPlaceK: 0 })).toEqual([]);
    expect(validateSettings({ ...ok(), eloPlaceK: 201 })).toEqual(["eloPlaceKInvalid"]);
    expect(validateSettings({ ...ok(), eloPlaceK: 4.5 })).toEqual(["eloPlaceKInvalid"]);
    expect(validateSettings({ ...ok(), eloStart: 50 })).toEqual(["eloStartInvalid"]);
    expect(validateSettings({ ...ok(), boards: 9 })).toEqual(["boardsInvalid"]);
    expect(validateSettings({ ...ok(), boards: 1 })).toEqual([]);
  });

  it("checks match formats", () => {
    const s = ok();
    s.fmt.final = { start: 401, bestOf: 7 };
    expect(validateSettings(s)).toEqual(["formatInvalid"]);
    s.fmt.final = { start: 501, bestOf: 4 };
    expect(validateSettings(s)).toEqual(["formatInvalid"]);
  });
});
