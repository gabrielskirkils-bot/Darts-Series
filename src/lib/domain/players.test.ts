import { describe, expect, it } from "vitest";
import {
  findDuplicateName,
  foldText,
  nameKey,
  normalizeName,
  searchPlayers,
  sortPlayers,
  validatePlayerInput,
} from "./players";

describe("normalizeName / nameKey", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeName("  Jānis   Bērziņš ")).toBe("Jānis Bērziņš");
  });

  it("key is case-insensitive", () => {
    expect(nameKey(" PETER Wright")).toBe(nameKey("peter wright"));
  });
});

describe("validatePlayerInput", () => {
  it("requires a name; nickname optional", () => {
    expect(validatePlayerInput({ name: "  ", nickname: "" }).errors).toEqual(["nameRequired"]);
    expect(validatePlayerInput({ name: "Anna", nickname: " " })).toEqual({
      value: { name: "Anna", nickname: null },
      errors: [],
    });
  });

  it("limits lengths", () => {
    expect(validatePlayerInput({ name: "x".repeat(61), nickname: "" }).errors).toEqual(["nameTooLong"]);
    expect(validatePlayerInput({ name: "Anna", nickname: "y".repeat(31) }).errors).toEqual(["nicknameTooLong"]);
  });
});

describe("findDuplicateName", () => {
  const players = [
    { id: "1", name: "Anna Ozola" },
    { id: "2", name: "Jānis Bērziņš" },
  ];

  it("matches case-insensitively and ignores extra spaces", () => {
    expect(findDuplicateName("anna  ozola ", players)?.id).toBe("1");
    expect(findDuplicateName("JĀNIS BĒRZIŅŠ", players)?.id).toBe("2");
  });

  it("ignores the player being edited and empty names", () => {
    expect(findDuplicateName("Anna Ozola", players, "1")).toBeNull();
    expect(findDuplicateName(" ", players)).toBeNull();
    expect(findDuplicateName("Anna", players)).toBeNull();
  });
});

describe("searchPlayers", () => {
  const players = [
    { name: "Jānis Bērziņš", nickname: "The Bear" },
    { name: "Anna Ozola", nickname: null },
    { name: "Pēteris Kalniņš", nickname: "Snakebite" },
  ];

  it("ignores case and diacritics", () => {
    expect(searchPlayers(players, "janis").map((p) => p.name)).toEqual(["Jānis Bērziņš"]);
    expect(searchPlayers(players, "KALNIN").map((p) => p.name)).toEqual(["Pēteris Kalniņš"]);
  });

  it("searches nicknames and requires every word", () => {
    expect(searchPlayers(players, "bear").map((p) => p.name)).toEqual(["Jānis Bērziņš"]);
    expect(searchPlayers(players, "anna oz").map((p) => p.name)).toEqual(["Anna Ozola"]);
    expect(searchPlayers(players, "anna bear")).toEqual([]);
  });

  it("empty query returns everyone", () => {
    expect(searchPlayers(players, "  ")).toHaveLength(3);
  });

  it("foldText strips diacritics", () => {
    expect(foldText("Ķēniņš")).toBe("kenins");
  });
});

describe("sortPlayers", () => {
  const players = [
    { name: "Cara", elo: 1500, points: 10, tournaments: 1 },
    { name: "anna", elo: 1600, points: 10, tournaments: 2 },
    { name: "Ben", elo: 1450, points: 75, tournaments: 1 },
  ];

  it("by name A→Z, case-insensitive", () => {
    expect(sortPlayers(players, "name").map((p) => p.name)).toEqual(["anna", "Ben", "Cara"]);
  });

  it("by number high→low, name breaks ties", () => {
    expect(sortPlayers(players, "elo").map((p) => p.name)).toEqual(["anna", "Cara", "Ben"]);
    expect(sortPlayers(players, "points").map((p) => p.name)).toEqual(["Ben", "anna", "Cara"]);
    expect(sortPlayers(players, "tournaments").map((p) => p.name)).toEqual(["anna", "Ben", "Cara"]);
  });
});
