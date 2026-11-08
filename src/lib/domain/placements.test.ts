import { describe, expect, it } from "vitest";
import {
  advanceWinner,
  applyUpdates,
  findMatch,
  generateKnockout,
  type Knockout,
  type SeededPlayer,
} from "./bracket";
import type { StandingRow } from "./groups";
import {
  groupEliminatedPlaces,
  groupsKnockoutPlaces,
  knockoutPlaces,
  roundRobinPlaces,
} from "./placements";

function row(playerId: string, position: number): StandingRow {
  return { playerId, position, played: 0, wins: 0, losses: 0, legsWon: 0, legsLost: 0, legDiff: 0, average: null };
}

/** Plays every knockout match; the lower seed number (earlier in `seeds`) always wins. */
function playOut(ko: Knockout, seeds: string[]) {
  const rank = (id: string | null) => (id ? seeds.indexOf(id) : Infinity);
  const order = [...ko.matches].sort((a, b) => a.round - b.round || (a.stage === "third" ? 1 : -1));
  for (const m of order) {
    if (m.isBye) continue;
    const winner = rank(m.p1) < rank(m.p2) ? m.p1! : m.p2!;
    const loser = winner === m.p1 ? m.p2! : m.p1!;
    m.status = "done";
    m.winnerId = winner;
    if (m.stage === "ko") applyUpdates(ko.matches, advanceWinner(m, winner, loser, ko.rounds, ko.third));
  }
}

function placeMap(list: { playerId: string; place: number }[]) {
  return Object.fromEntries(list.map((p) => [p.playerId, p.place]));
}

describe("roundRobinPlaces", () => {
  it("place = table position", () => {
    expect(roundRobinPlaces([row("a", 1), row("b", 2), row("c", 3)])).toEqual([
      { playerId: "a", place: 1 },
      { playerId: "b", place: 2 },
      { playerId: "c", place: 3 },
    ]);
  });
});

describe("knockoutPlaces", () => {
  const ids = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);
  const seeds = (n: number): SeededPlayer[] => ids.slice(0, n).map((playerId) => ({ playerId, group: null }));

  it("8 players without third place: semi-final losers share 3rd, QF losers 5th", () => {
    const ko = generateKnockout(seeds(8), 1, false);
    playOut(ko, ids);
    expect(placeMap(knockoutPlaces(ko.matches, ko.rounds))).toEqual({
      p1: 1,
      p2: 2,
      p3: 3,
      p4: 3,
      p5: 5,
      p6: 5,
      p7: 5,
      p8: 5,
    });
  });

  it("with a third-place match: 3 and 4", () => {
    const ko = generateKnockout(seeds(8), 1, true);
    playOut(ko, ids);
    const places = placeMap(knockoutPlaces(ko.matches, ko.rounds));
    expect(places.p3).toBe(3);
    expect(places.p4).toBe(4);
    expect(Object.values(places).filter((p) => p === 3)).toHaveLength(1);
  });

  it("byes give no place to an empty slot; 6 players → 1, 2, 3, 3, 5, 5", () => {
    const ko = generateKnockout(seeds(6), 1, false);
    playOut(ko, ids);
    const places = knockoutPlaces(ko.matches, ko.rounds);
    expect(places.map((p) => p.place)).toEqual([1, 2, 3, 3, 5, 5]);
  });

  it("last 16 losers get 9th", () => {
    const all = Array.from({ length: 16 }, (_, i) => `q${i + 1}`);
    const ko = generateKnockout(all.map((playerId) => ({ playerId, group: null })), 1, false);
    playOut(ko, all);
    const places = placeMap(knockoutPlaces(ko.matches, ko.rounds));
    expect(places.q16).toBe(9);
    expect(places.q9).toBe(9);
    expect(places.q8).toBe(5);
  });
});

describe("groupEliminatedPlaces", () => {
  it("8 qualified: all 3rd-placed share 9th, 4th-placed share the next place", () => {
    const tables = ["A", "B", "C", "D"].map((g) => [1, 2, 3, 4].map((p) => row(`${g}${p}`, p)));
    const places = placeMap(groupEliminatedPlaces(tables, 2));
    expect(places).toEqual({
      A3: 9,
      B3: 9,
      C3: 9,
      D3: 9,
      A4: 13,
      B4: 13,
      C4: 13,
      D4: 13,
    });
  });

  it("uneven groups: 11 players in 3 groups, top 2", () => {
    const sizes = [3, 4, 4];
    const tables = sizes.map((size, g) =>
      Array.from({ length: size }, (_, i) => row(`${"ABC"[g]}${i + 1}`, i + 1)),
    );
    const places = placeMap(groupEliminatedPlaces(tables, 2));
    expect(places).toEqual({ A3: 7, B3: 7, C3: 7, B4: 10, C4: 10 });
  });
});

describe("groupsKnockoutPlaces", () => {
  it("gives every entrant exactly one place", () => {
    const tables = ["A", "B", "C"].map((g, gi) =>
      Array.from({ length: gi === 0 ? 3 : 4 }, (_, i) => row(`${g}${i + 1}`, i + 1)),
    );
    const seeds: SeededPlayer[] = ["A1", "B1", "C1", "C2", "B2", "A2"].map((playerId) => ({
      playerId,
      group: "ABC".indexOf(playerId[0]!),
    }));
    const ko = generateKnockout(seeds, 3, false);
    playOut(
      ko,
      seeds.map((s) => s.playerId),
    );
    const places = groupsKnockoutPlaces(tables, 2, ko.matches, ko.rounds);
    expect(places).toHaveLength(11);
    expect(new Set(places.map((p) => p.playerId)).size).toBe(11);
    expect(placeMap(places).A1).toBe(1);
    expect(findMatch(ko.matches, "ko", 3, 0)!.winnerId).toBe("A1");
  });
});
