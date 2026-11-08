import { describe, expect, it } from "vitest";
import { dateInZone, formatDate, formatMinutes } from "./time";

describe("dateInZone", () => {
  it("uses Riga's calendar date, not UTC", () => {
    // 22:30 UTC on 8 Nov = 00:30 on 9 Nov in Riga (UTC+2 in winter).
    expect(dateInZone(new Date("2026-11-08T22:30:00Z"))).toBe("2026-11-09");
    expect(dateInZone(new Date("2026-11-08T12:00:00Z"))).toBe("2026-11-08");
    expect(dateInZone(new Date("2026-11-08T22:30:00Z"), "UTC")).toBe("2026-11-08");
  });
});

describe("formatDate", () => {
  it("formats ISO dates", () => {
    expect(formatDate("2026-11-08")).toBe("8 Nov 2026");
    expect(formatDate("2027-01-31")).toBe("31 Jan 2027");
  });
});

describe("formatMinutes", () => {
  it("formats hours and minutes", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(155.4)).toBe("2 h 35 min");
    expect(formatMinutes(-3)).toBe("0 min");
  });
});
