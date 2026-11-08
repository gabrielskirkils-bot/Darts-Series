import { describe, expect, it } from "vitest";
import {
  advanceWinner,
  applyUpdates,
  bracketSize,
  editKnockoutWinner,
  findMatch,
  generateKnockout,
  placeSeeds,
  roundName,
  seedOrder,
  seedsFromGroups,
  type KoMatch,
  type SeededPlayer,
} from "./bracket";
import type { StandingRow } from "./groups";

function row(playerId: string, position: number, extra: Partial<StandingRow> = {}): StandingRow {
  return {
    playerId,
    position,
    played: 3,
    wins: 0,
    losses: 0,
    legsWon: 0,
    legsLost: 0,
    legDiff: 0,
    average: null,
    ...extra,
  };
}

/** Group tables where player "<G><pos>" (e.g. A1, B2) finished at that position. */
function tables(groupCount: number, perGroup: number): StandingRow[][] {
  return Array.from({ length: groupCount }, (_, g) =>
    Array.from({ length: perGroup }, (_, i) => row(`${String.fromCharCode(65 + g)}${i + 1}`, i + 1)),
  );
}

function firstRoundPairs(matches: KoMatch[]) {
  return matches
    .filter((m) => m.stage === "ko" && m.round === 1)
    .sort((a, b) => a.slot - b.slot)
    .map((m) => [m.p1, m.p2]);
}

function groupOf(id: string | null) {
  return id ? id[0] : null;
}

describe("bracketSize / seedOrder / roundName", () => {
  it("bracket size is the smallest power of two ≥ qualified", () => {
    expect(bracketSize(2)).toBe(2);
    expect(bracketSize(3)).toBe(4);
    expect(bracketSize(6)).toBe(8);
    expect(bracketSize(8)).toBe(8);
    expect(bracketSize(9)).toBe(16);
  });

  it("standard seed order", () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedOrder(16)).toHaveLength(16);
    expect(seedOrder(16).slice(0, 4)).toEqual([1, 16, 8, 9]);
  });

  it("round names count from the end", () => {
    expect(roundName(3, 3).name).toBe("final");
    expect(roundName(2, 3).name).toBe("semiFinal");
    expect(roundName(1, 3).name).toBe("quarterFinal");
    expect(roundName(1, 4).name).toBe("last16");
    expect(roundName(1, 5).name).toBe("last32");
    expect(roundName(1, 6)).toEqual({ name: "lastN", size: 64 });
  });
});

describe("seedsFromGroups", () => {
  it("tier 1 = winners in group order, tier 2 = runners-up in reverse group order", () => {
    const seeds = seedsFromGroups(tables(3, 4), 2).map((s) => s.playerId);
    expect(seeds).toEqual(["A1", "B1", "C1", "C2", "B2", "A2"]);
  });

  it("tier 3+ by performance", () => {
    const t = tables(3, 4);
    t[0]![2] = row("A3", 3, { wins: 1, played: 3 });
    t[1]![2] = row("B3", 3, { wins: 2, played: 3 });
    t[2]![2] = row("C3", 3, { wins: 1, played: 3, legDiff: 2 });
    const seeds = seedsFromGroups(t, 3).map((s) => s.playerId);
    expect(seeds.slice(6)).toEqual(["B3", "C3", "A3"]);
  });

  it("uses win rate when group sizes differ", () => {
    const t = [
      [row("A1", 1), row("A2", 2), row("A3", 3, { wins: 2, played: 4 })],
      [row("B1", 1), row("B2", 2), row("B3", 3, { wins: 1, played: 2 })],
      [row("C1", 1), row("C2", 2), row("C3", 3, { wins: 2, played: 3 })],
    ];
    expect(seedsFromGroups(t, 3).slice(6).map((s) => s.playerId)).toEqual(["C3", "A3", "B3"]);
  });
});

describe("placeSeeds (no same-group meetings in round 1)", () => {
  it("2 groups, top 2: swaps runners-up so winners don't meet their own runner-up", () => {
    const seeds = seedsFromGroups(tables(2, 3), 2); // A1, B1, B2, A2
    const ko = generateKnockout(seeds, 2, false);
    const pairs = firstRoundPairs(ko.matches);
    for (const [a, b] of pairs) expect(groupOf(a)).not.toBe(groupOf(b));
  });

  it("4 groups, top 2: resolves every clash", () => {
    const ko = generateKnockout(seedsFromGroups(tables(4, 4), 2), 4, false);
    const pairs = firstRoundPairs(ko.matches);
    expect(pairs).toHaveLength(4);
    for (const [a, b] of pairs) expect(groupOf(a)).not.toBe(groupOf(b));
    // Group winners keep their bracket positions.
    expect(pairs.map((p) => p[0])).toEqual(["A1", "D1", "B1", "C1"]);
  });

  it("8 groups, top 2 (32 players): no clashes", () => {
    const ko = generateKnockout(seedsFromGroups(tables(8, 4), 2), 8, false);
    for (const [a, b] of firstRoundPairs(ko.matches)) expect(groupOf(a)).not.toBe(groupOf(b));
  });

  it("only swaps within a tier", () => {
    const seeds = seedsFromGroups(tables(4, 4), 2);
    const placed = placeSeeds(seeds, 4);
    expect(placed.slice(0, 4).map((s) => s!.playerId)).toEqual(["A1", "B1", "C1", "D1"]);
    expect(
      placed
        .slice(4)
        .map((s) => s!.playerId)
        .sort(),
    ).toEqual(["A2", "B2", "C2", "D2"]);
  });

  it("skips clash avoidance with one group", () => {
    const seeds: SeededPlayer[] = ["A1", "A2", "A3", "A4"].map((playerId) => ({ playerId, group: 0 }));
    expect(placeSeeds(seeds, 1).map((s) => s!.playerId)).toEqual(["A1", "A2", "A3", "A4"]);
  });
});

describe("generateKnockout", () => {
  it("11 players / 3 groups / top 2: quarter-finals with 2 byes for the top seeds", () => {
    const ko = generateKnockout(seedsFromGroups(tables(3, 4), 2), 3, false);
    expect(ko).toMatchObject({ size: 8, rounds: 3, qualified: 6, third: false });
    const r1 = ko.matches.filter((m) => m.round === 1);
    expect(r1).toHaveLength(4);
    const byes = r1.filter((m) => m.isBye);
    expect(byes).toHaveLength(2);
    expect(byes.every((m) => m.status === "done")).toBe(true);
    expect(byes.map((m) => m.winnerId).sort()).toEqual(["A1", "B1"]);
    // Bye winners already sit in the semi-finals.
    const semis = ko.matches.filter((m) => m.round === 2);
    expect(semis.flatMap((m) => [m.p1, m.p2]).filter(Boolean).sort()).toEqual(["A1", "B1"]);
    for (const [a, b] of firstRoundPairs(ko.matches)) {
      if (a && b) expect(groupOf(a)).not.toBe(groupOf(b));
    }
  });

  it("creates every round with the right number of slots", () => {
    const seeds: SeededPlayer[] = Array.from({ length: 16 }, (_, i) => ({ playerId: `p${i + 1}`, group: null }));
    const ko = generateKnockout(seeds, 1, true);
    const perRound = [1, 2, 3, 4].map((r) => ko.matches.filter((m) => m.stage === "ko" && m.round === r).length);
    expect(perRound).toEqual([8, 4, 2, 1]);
    expect(ko.matches.filter((m) => m.stage === "third")).toHaveLength(1);
    expect(firstRoundPairs(ko.matches)[0]).toEqual(["p1", "p16"]);
  });

  it("no third-place match when a semi-final has a bye", () => {
    const seeds: SeededPlayer[] = ["x", "y", "z"].map((playerId) => ({ playerId, group: null }));
    const ko = generateKnockout(seeds, 1, true);
    expect(ko.third).toBe(false);
    expect(ko.matches.some((m) => m.stage === "third")).toBe(false);
    expect(findMatch(ko.matches, "ko", 2, 0)!.p1).toBe("x"); // top seed's bye advanced to the final
  });

  it("a two-player knockout is just the final", () => {
    const ko = generateKnockout(
      [
        { playerId: "a", group: 0 },
        { playerId: "b", group: 0 },
      ],
      1,
      true,
    );
    expect(ko.rounds).toBe(1);
    expect(ko.matches).toHaveLength(1);
    expect(ko.matches[0]).toMatchObject({ p1: "a", p2: "b", isBye: false });
  });

  it("refuses fewer than 2 players", () => {
    expect(() => generateKnockout([{ playerId: "a", group: null }], 1, false)).toThrow();
  });
});

describe("advancement", () => {
  it("winner goes to (r+1, slot div 2): even slot → p1, odd slot → p2", () => {
    expect(advanceWinner({ stage: "ko", round: 1, slot: 2 }, "w", "l", 3)).toEqual([
      { stage: "ko", round: 2, slot: 1, side: "p1", playerId: "w" },
    ]);
    expect(advanceWinner({ stage: "ko", round: 1, slot: 3 }, "w", "l", 3)).toEqual([
      { stage: "ko", round: 2, slot: 1, side: "p2", playerId: "w" },
    ]);
    expect(advanceWinner({ stage: "ko", round: 3, slot: 0 }, "w", "l", 3)).toEqual([]);
  });

  it("after both semi-finals the final and third-place match are filled (SPEC 8.6)", () => {
    const seeds: SeededPlayer[] = ["s1", "s2", "s3", "s4"].map((playerId) => ({ playerId, group: null }));
    const ko = generateKnockout(seeds, 1, true);
    const semi0 = findMatch(ko.matches, "ko", 1, 0)!; // s1 v s4
    const semi1 = findMatch(ko.matches, "ko", 1, 1)!; // s2 v s3
    applyUpdates(ko.matches, advanceWinner(semi0, "s4", "s1", ko.rounds));
    applyUpdates(ko.matches, advanceWinner(semi1, "s2", "s3", ko.rounds));
    expect(findMatch(ko.matches, "ko", 2, 0)).toMatchObject({ p1: "s4", p2: "s2" });
    expect(findMatch(ko.matches, "third", 2, 0)).toMatchObject({ p1: "s1", p2: "s3" });
  });
});

describe("editKnockoutWinner", () => {
  function playedSemis() {
    const seeds: SeededPlayer[] = ["s1", "s2", "s3", "s4"].map((playerId) => ({ playerId, group: null }));
    const ko = generateKnockout(seeds, 1, true);
    const semi0 = findMatch(ko.matches, "ko", 1, 0)!;
    Object.assign(semi0, { status: "done", winnerId: "s1" });
    applyUpdates(ko.matches, advanceWinner(semi0, "s1", "s4", ko.rounds));
    return { ko, semi0 };
  }

  it("swaps the winner in the next match if it hasn't started", () => {
    const { ko, semi0 } = playedSemis();
    const res = editKnockoutWinner(ko.matches, semi0, "s4", ko.rounds);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    applyUpdates(ko.matches, res.updates);
    expect(findMatch(ko.matches, "ko", 2, 0)!.p1).toBe("s4");
    expect(findMatch(ko.matches, "third", 2, 0)!.p1).toBe("s1");
  });

  it("refuses when the next match has started", () => {
    const { ko, semi0 } = playedSemis();
    findMatch(ko.matches, "ko", 2, 0)!.status = "live";
    expect(editKnockoutWinner(ko.matches, semi0, "s4", ko.rounds)).toEqual({ ok: false, error: "nextMatchStarted" });
  });

  it("refuses when the third-place match has started", () => {
    const { ko, semi0 } = playedSemis();
    findMatch(ko.matches, "third", 2, 0)!.status = "done";
    expect(editKnockoutWinner(ko.matches, semi0, "s4", ko.rounds).ok).toBe(false);
  });
});
