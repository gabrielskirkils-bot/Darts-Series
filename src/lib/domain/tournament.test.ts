import { describe, expect, it } from "vitest";
import { DEFAULT_FORMATS, previewStructure, suggestStructure } from "./structure";
import {
  bracketColumns,
  canEnterResult,
  canRedrawGroups,
  canStartKnockout,
  groupTables,
  knockoutFormat,
  matchBuckets,
  normalizeStructure,
  parseKoMeta,
  parseTournamentInput,
  planDraw,
  planConfirm,
  planKnockoutFromGroups,
  planManualResult,
  tournamentOverview,
  tournamentProgress,
  validateTournamentInput,
  type DrawConfig,
  type MatchRow,
  type TournamentInput,
} from "./tournament";

const entrants = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ playerId: `p${i + 1}`, elo: 2000 - i * 10 }));

const config = (over: Partial<DrawConfig> = {}): DrawConfig => ({
  format: "groups_ko",
  groupCount: 3,
  thirdPlace: false,
  seeding: "elo",
  formats: DEFAULT_FORMATS,
  ...over,
});

/** Turns plans into DB-like rows so the rest of the flow can run on them. */
function rows(plan: ReturnType<typeof planDraw>["matches"]): MatchRow[] {
  return plan.map((m, i) => ({
    id: `m${i}`,
    stage: m.stage,
    groupIndex: m.groupIndex,
    round: m.round,
    slot: m.slot,
    sortOrder: m.sortOrder,
    p1: m.p1,
    p2: m.p2,
    legsP1: 0,
    legsP2: 0,
    winnerId: m.winnerId,
    status: m.status,
    isBye: m.isBye,
    isManual: false,
    bestOf: m.bestOf,
    startScore: m.startScore,
    board: null,
  }));
}

/** Finishes every group match: the better seed (lower number) wins 2–0. */
function finishGroups(matches: MatchRow[]) {
  for (const m of matches) {
    if (m.stage !== "group") continue;
    const a = Number(m.p1!.slice(1));
    const b = Number(m.p2!.slice(1));
    m.status = "done";
    m.winnerId = a < b ? m.p1 : m.p2;
    m.legsP1 = a < b ? 2 : 0;
    m.legsP2 = a < b ? 0 : 2;
  }
}

describe("planDraw: groups", () => {
  it("11 players, 3 groups by Elo snake: sizes 3/4/4 and all round-robin matches (SPEC 8.1)", () => {
    const plan = planDraw(entrants(11), config(), Math.random);
    expect(plan.status).toBe("groups");
    expect(plan.ko).toBeNull();
    const sizes = [0, 1, 2].map((g) => plan.players.filter((p) => p.groupIndex === g).length);
    expect(sizes).toEqual([3, 4, 4]);
    expect(plan.players.find((p) => p.playerId === "p1")).toEqual({ playerId: "p1", seed: 1, groupIndex: 0 });
    expect(plan.matches).toHaveLength(3 + 6 + 6);
    expect(plan.matches.every((m) => m.stage === "group" && m.startScore === 301 && m.bestOf === 3)).toBe(true);
    expect(plan.matches.map((m) => m.sortOrder)).toEqual(plan.matches.map((_, i) => i));
    // Every match is within one group.
    const groupOf = new Map(plan.players.map((p) => [p.playerId, p.groupIndex]));
    for (const m of plan.matches) {
      expect(groupOf.get(m.p1!)).toBe(m.groupIndex);
      expect(groupOf.get(m.p2!)).toBe(m.groupIndex);
    }
  });

  it("round robin puts everyone in one group", () => {
    const plan = planDraw(entrants(3), config({ format: "rr", groupCount: 7 }), Math.random);
    expect(plan.players.every((p) => p.groupIndex === 0)).toBe(true);
    expect(plan.matches).toHaveLength(3);
  });

  it("random seeding uses the RNG", () => {
    const a = planDraw(entrants(8), config({ seeding: "random", groupCount: 2 }), () => 0);
    const b = planDraw(entrants(8), config({ seeding: "random", groupCount: 2 }), () => 0.99);
    expect(a.players.map((p) => p.playerId)).not.toEqual(b.players.map((p) => p.playerId));
  });
});

describe("planDraw: knockout only", () => {
  it("generates the bracket at once with byes done and formats per round", () => {
    const plan = planDraw(entrants(6), config({ format: "ko", thirdPlace: true }), Math.random);
    expect(plan.status).toBe("ko");
    expect(plan.ko).toEqual({ rounds: 3, size: 8, qualified: 6, third: true });
    expect(plan.players.every((p) => p.groupIndex === null)).toBe(true);
    const byes = plan.matches.filter((m) => m.isBye);
    expect(byes).toHaveLength(2);
    expect(byes.every((m) => m.status === "done" && m.winnerId)).toBe(true);
    const final = plan.matches.find((m) => m.stage === "ko" && m.round === 3)!;
    expect([final.startScore, final.bestOf]).toEqual([501, 7]);
    const third = plan.matches.find((m) => m.stage === "third")!;
    expect([third.startScore, third.bestOf]).toEqual([501, 5]);
    expect(third.sortOrder).toBeLessThan(final.sortOrder);
  });
});

describe("knockout from groups", () => {
  it("11 players: quarter-finals, 2 byes for A1 and B1, no same-group pairs", () => {
    const plan = planDraw(entrants(11), config(), Math.random);
    const matches = rows(plan.matches);
    expect(canStartKnockout("groups_ko", "groups", matches)).toBe(false);
    finishGroups(matches);
    expect(canStartKnockout("groups_ko", "groups", matches)).toBe(true);

    const tables = groupTables(plan.players, matches, 3);
    expect(tables.map((t) => t[0]!.playerId)).toEqual(["p1", "p2", "p3"]);

    const ko = planKnockoutFromGroups(tables, 2, false, DEFAULT_FORMATS);
    expect(ko.ko).toEqual({ rounds: 3, size: 8, qualified: 6, third: false });
    const r1 = ko.matches.filter((m) => m.round === 1);
    expect(r1.filter((m) => m.isBye).map((m) => m.winnerId).sort()).toEqual(["p1", "p2"]);
    const groupOf = new Map(plan.players.map((p) => [p.playerId, p.groupIndex]));
    for (const m of r1.filter((x) => !x.isBye)) {
      expect(groupOf.get(m.p1!)).not.toBe(groupOf.get(m.p2!));
    }
    expect(ko.matches.every((m) => m.sortOrder >= 10_000)).toBe(true);
  });

  it("single group, top 2: just the final", () => {
    const plan = planDraw(entrants(4), config({ groupCount: 1 }), Math.random);
    const matches = rows(plan.matches);
    finishGroups(matches);
    const ko = planKnockoutFromGroups(groupTables(plan.players, matches, 1), 2, true, DEFAULT_FORMATS);
    expect(ko.ko.rounds).toBe(1);
    expect(ko.matches).toHaveLength(1);
    expect(ko.matches[0]).toMatchObject({ p1: "p1", p2: "p2", startScore: 501, bestOf: 7 });
  });
});

describe("redraw / start rules", () => {
  it("redraw only while every group match is pending", () => {
    const matches = rows(planDraw(entrants(8), config({ groupCount: 2 }), Math.random).matches);
    expect(canRedrawGroups("groups", matches)).toBe(true);
    matches[0]!.status = "live";
    expect(canRedrawGroups("groups", matches)).toBe(false);
    expect(canRedrawGroups("ko", [])).toBe(false);
  });

  it("knockout can't start for other formats or after it started", () => {
    expect(canStartKnockout("rr", "groups", [])).toBe(false);
    expect(canStartKnockout("groups_ko", "ko", [])).toBe(false);
  });
});

describe("knockoutFormat", () => {
  it("final uses the final format, third-place and earlier rounds knockout", () => {
    expect(knockoutFormat("ko", 3, 3, DEFAULT_FORMATS)).toBe(DEFAULT_FORMATS.final);
    expect(knockoutFormat("ko", 2, 3, DEFAULT_FORMATS)).toBe(DEFAULT_FORMATS.ko);
    expect(knockoutFormat("third", 3, 3, DEFAULT_FORMATS)).toBe(DEFAULT_FORMATS.ko);
  });
});

describe("parseKoMeta / normalizeStructure", () => {
  it("reads stored knockout meta", () => {
    expect(parseKoMeta({ rounds: 3, size: 8, qualified: 6, third: true })).toEqual({
      rounds: 3,
      size: 8,
      qualified: 6,
      third: true,
    });
    expect(parseKoMeta(null)).toBeNull();
    expect(parseKoMeta({ rounds: 0, size: 2, qualified: 2 })).toBeNull();
    expect(parseKoMeta({ rounds: "3", size: 8, qualified: 6 })).toBeNull();
    expect(parseKoMeta([1, 2])).toBeNull();
  });

  it("stores round robin and knockout only without group settings", () => {
    expect(normalizeStructure({ format: "rr", groupCount: 3, advance: 2, thirdPlace: true })).toEqual({
      format: "rr",
      groupCount: 1,
      advance: 0,
      thirdPlace: false,
    });
    expect(normalizeStructure({ format: "ko", groupCount: 3, advance: 2, thirdPlace: true })).toEqual({
      format: "ko",
      groupCount: 1,
      advance: 0,
      thirdPlace: true,
    });
    const g = { format: "groups_ko" as const, groupCount: 3, advance: 2, thirdPlace: false };
    expect(normalizeStructure(g)).toEqual(g);
  });
});

describe("bracketColumns / matchBuckets", () => {
  it("groups knockout matches per round with the third-place match apart", () => {
    const matches = rows(planDraw(entrants(6), config({ format: "ko", thirdPlace: true }), Math.random).matches);
    const { columns, third } = bracketColumns(matches, 3);
    expect(columns.map((c) => c.length)).toEqual([4, 2, 1]);
    expect(columns[0]!.map((m) => m.slot)).toEqual([0, 1, 2, 3]);
    expect(third?.stage).toBe("third");
  });

  it("splits live / waiting / finished and drops byes", () => {
    const matches = rows(planDraw(entrants(6), config({ format: "ko" }), Math.random).matches);
    const r1 = matches.filter((m) => m.round === 1 && !m.isBye);
    r1[0]!.status = "live";
    r1[0]!.board = 2;
    r1[1]!.status = "done";
    const b = matchBuckets(matches);
    expect(b.live.map((m) => m.id)).toEqual([r1[0]!.id]);
    expect(b.finished.map((m) => m.id)).toEqual([r1[1]!.id]);
    expect(b.waiting.every((m) => m.status === "pending" && !m.isBye)).toBe(true);
    expect(b.live.length + b.waiting.length + b.finished.length).toBe(matches.filter((m) => !m.isBye).length);
  });
});

describe("planManualResult (fallback entry, SPEC 4.7)", () => {
  // 6 players, knockout only, third place: R1 = [1 v bye, 4 v 5, 2 v bye, 3 v 6].
  const setup = () => rows(planDraw(entrants(6), config({ format: "ko", thirdPlace: true }), Math.random).matches);
  const find = (ms: MatchRow[], stage: string, round: number, slot: number) =>
    ms.find((m) => m.stage === stage && m.round === round && m.slot === slot)!;

  it("first-round result sends the winner on", () => {
    const ms = setup();
    const m = find(ms, "ko", 1, 1);
    expect([m.p1, m.p2]).toEqual(["p4", "p5"]);
    expect(planManualResult(ms, m.id, "ko", 3, 1, 3)).toEqual({
      ok: true,
      winnerId: "p4",
      slots: [{ stage: "ko", round: 2, slot: 0, side: "p2", playerId: "p4" }],
    });
  });

  it("semi-final result also fills the third-place match", () => {
    const ms = setup();
    const semi = find(ms, "ko", 2, 1);
    semi.p2 = "p3";
    const plan = planManualResult(ms, semi.id, "ko", 1, 3, 3);
    expect(plan).toEqual({
      ok: true,
      winnerId: "p3",
      slots: [
        { stage: "ko", round: 3, slot: 0, side: "p2", playerId: "p3" },
        { stage: "third", round: 3, slot: 0, side: "p2", playerId: "p2" },
      ],
    });
  });

  it("rejects unfinished scores", () => {
    const ms = setup();
    expect(planManualResult(ms, find(ms, "ko", 1, 1).id, "ko", 2, 1, 3)).toEqual({ ok: false, error: "invalidScore" });
  });

  it("editing a manual winner swaps the next match only while it is pending", () => {
    const ms = setup();
    const m = find(ms, "ko", 1, 1);
    Object.assign(m, { status: "done", isManual: true, winnerId: "p4", legsP1: 3, legsP2: 1 });
    const next = find(ms, "ko", 2, 0);
    next.p2 = "p4";

    expect(planManualResult(ms, m.id, "ko", 3, 2, 3)).toEqual({ ok: true, winnerId: "p4", slots: [] });
    expect(planManualResult(ms, m.id, "ko", 2, 3, 3)).toMatchObject({
      ok: true,
      winnerId: "p5",
      slots: [{ stage: "ko", round: 2, slot: 0, side: "p2", playerId: "p5" }],
    });
    next.status = "live";
    expect(planManualResult(ms, m.id, "ko", 2, 3, 3)).toEqual({ ok: false, error: "nextMatchStarted" });
  });

  it("refuses byes, live, scored or incomplete matches and closed stages", () => {
    const ms = setup();
    const bye = ms.find((m) => m.isBye)!;
    expect(canEnterResult(bye, "ko")).toBe(false);
    const m = find(ms, "ko", 1, 1);
    expect(canEnterResult(m, "ko")).toBe(true);
    expect(canEnterResult(m, "done")).toBe(false);
    expect(canEnterResult({ ...m, status: "live" }, "ko")).toBe(false);
    expect(canEnterResult({ ...m, status: "done", isManual: false }, "ko")).toBe(false);
    expect(canEnterResult(find(ms, "ko", 3, 0), "ko")).toBe(false); // final: players unknown
    expect(canEnterResult({ ...m, stage: "group" }, "ko")).toBe(false);
    expect(planManualResult(ms, "missing", "ko", 3, 0, 3)).toEqual({ ok: false, error: "notEditable" });
  });

  it("group results need no advancement", () => {
    const plan = planDraw(entrants(4), config({ groupCount: 1 }), Math.random);
    const ms = rows(plan.matches);
    expect(planManualResult(ms, ms[0]!.id, "groups", 2, 0, null)).toEqual({ ok: true, winnerId: ms[0]!.p1, slots: [] });
  });
});

describe("tournamentOverview", () => {
  it("11 players in groups: 3 tables, top 2 highlighted, quarter-finals planned", () => {
    const plan = planDraw(entrants(11), config(), Math.random);
    const base = {
      format: "groups_ko" as const,
      status: "groups" as const,
      groupCount: 3,
      advance: 2,
      thirdPlace: false,
      boards: 2,
      fmt: DEFAULT_FORMATS,
      ko: null,
      entrants: plan.players,
      matches: rows(plan.matches),
      averages: {},
    };
    const o = tournamentOverview(base);
    expect(o.rounds).toBe(3);
    expect(o.tables.map((t) => t.length)).toEqual([3, 4, 4]);
    expect(o.qualifiers).toBe(2);
    expect(o.progress).toEqual({ done: 0, total: 20 });
    expect(o.canRedraw).toBe(true);
    expect(o.canStartKnockout).toBe(false);
    expect(o.bracket.columns).toEqual([]);
    expect(o.buckets.waiting).toHaveLength(15);

    finishGroups(base.matches);
    const done = tournamentOverview(base);
    expect(done.canRedraw).toBe(false);
    expect(done.canStartKnockout).toBe(true);
  });

  it("knockout only: no tables, bracket from stored meta", () => {
    const plan = planDraw(entrants(6), config({ format: "ko", thirdPlace: true }), Math.random);
    const o = tournamentOverview({
      format: "ko",
      status: "ko",
      groupCount: 1,
      advance: 0,
      thirdPlace: true,
      boards: 2,
      fmt: DEFAULT_FORMATS,
      ko: plan.ko,
      entrants: plan.players,
      matches: rows(plan.matches),
      averages: {},
    });
    expect(o.tables).toEqual([]);
    expect(o.qualifiers).toBe(0);
    expect(o.canRedraw).toBe(false);
    expect(o.bracket.columns.map((c) => c.length)).toEqual([4, 2, 1]);
    expect(o.progress).toEqual({ done: 0, total: 6 });
  });
});

describe("planConfirm (SPEC 8.6)", () => {
  const setup = () => rows(planDraw(entrants(4), config({ format: "ko", thirdPlace: true }), Math.random).matches);
  const find = (ms: MatchRow[], stage: string, round: number, slot: number) =>
    ms.find((m) => m.stage === stage && m.round === round && m.slot === slot)!;

  it("after both semi-finals, the final and third-place match hold the right players", () => {
    const ms = setup(); // semis: p1 v p4, p2 v p3
    const s0 = find(ms, "ko", 1, 0);
    const s1 = find(ms, "ko", 1, 1);
    s0.status = "live";
    const a = planConfirm(ms, s0.id, 1, 2)!; // p4 beats p1
    expect(a.winnerId).toBe("p4");
    expect(a.slots).toEqual([
      { stage: "ko", round: 2, slot: 0, side: "p1", playerId: "p4" },
      { stage: "third", round: 2, slot: 0, side: "p1", playerId: "p1" },
    ]);
    s1.status = "live";
    const b = planConfirm(ms, s1.id, 0, 2)!; // p2 beats p3
    expect(b.slots).toEqual([
      { stage: "ko", round: 2, slot: 0, side: "p2", playerId: "p2" },
      { stage: "third", round: 2, slot: 0, side: "p2", playerId: "p3" },
    ]);
  });

  it("group matches don't advance; only live matches can be confirmed", () => {
    const ms = rows(planDraw(entrants(4), config({ groupCount: 1 }), Math.random).matches);
    expect(planConfirm(ms, ms[0]!.id, 0, null)).toBeNull();
    ms[0]!.status = "live";
    expect(planConfirm(ms, ms[0]!.id, 0, null)).toEqual({ winnerId: ms[0]!.p1, slots: [] });
  });
});

describe("tournamentProgress", () => {
  it("counts done matches, excludes byes, adds expected knockout before it exists", () => {
    const plan = planDraw(entrants(11), config(), Math.random);
    const matches = rows(plan.matches);
    const expectedKo = previewStructure(11, suggestStructure(11), DEFAULT_FORMATS, 2).knockoutMatches;
    expect(tournamentProgress(matches, expectedKo)).toEqual({ done: 0, total: 15 + 5 });
    finishGroups(matches);
    expect(tournamentProgress(matches, expectedKo)).toEqual({ done: 15, total: 20 });

    const ko = rows(planDraw(entrants(6), config({ format: "ko" }), Math.random).matches);
    expect(tournamentProgress(ko, 99)).toEqual({ done: 0, total: 5 });
  });
});

describe("validateTournamentInput", () => {
  const valid = (): TournamentInput => ({
    name: "Event #1",
    date: "2026-11-08",
    playerIds: entrants(11).map((e) => e.playerId),
    structure: suggestStructure(11),
    seeding: "elo",
    formats: DEFAULT_FORMATS,
    boards: 2,
  });

  it("accepts a valid tournament", () => {
    expect(validateTournamentInput(valid())).toEqual([]);
  });

  it("checks name, date, boards and duplicate players", () => {
    expect(validateTournamentInput({ ...valid(), name: " " })).toContain("nameRequired");
    expect(validateTournamentInput({ ...valid(), date: "2026-02-30" })).toContain("dateInvalid");
    expect(validateTournamentInput({ ...valid(), date: "08.11.2026" })).toContain("dateInvalid");
    expect(validateTournamentInput({ ...valid(), boards: 0 })).toContain("boardsInvalid");
    expect(validateTournamentInput({ ...valid(), playerIds: ["a", "a", "b"] })).toContain("duplicatePlayers");
  });

  it("parses client input shape and rejects malformed data", () => {
    expect(parseTournamentInput(valid())).toEqual(valid());
    expect(parseTournamentInput(null)).toBeNull();
    expect(parseTournamentInput({ ...valid(), playerIds: [1, 2] })).toBeNull();
    expect(parseTournamentInput({ ...valid(), seeding: "abc" })).toBeNull();
    expect(parseTournamentInput({ ...valid(), structure: { ...suggestStructure(11), format: "swiss" } })).toBeNull();
    expect(parseTournamentInput({ ...valid(), formats: { ...DEFAULT_FORMATS, final: { start: "501" } } })).toBeNull();
    expect(parseTournamentInput({ ...valid(), boards: Number.NaN })).toBeNull();
  });

  it("includes structure and format errors", () => {
    expect(validateTournamentInput({ ...valid(), playerIds: ["a"] })).toContain("tooFewPlayers");
    expect(
      validateTournamentInput({ ...valid(), structure: { ...suggestStructure(11), advance: 4 } }),
    ).toContain("advanceTooHigh");
    expect(
      validateTournamentInput({ ...valid(), formats: { ...DEFAULT_FORMATS, final: { start: 400, bestOf: 7 } } }),
    ).toContain("formatInvalid");
  });
});
