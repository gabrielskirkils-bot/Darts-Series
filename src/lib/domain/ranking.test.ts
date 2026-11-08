import { describe, expect, it } from "vitest";
import {
  playerProfile,
  rankingView,
  rankingYears,
  statsTable,
  tournamentEloChange,
  type EloRow,
  type ProfileMatch,
  type RankingData,
} from "./ranking";
import { EMPTY_TOTALS, type StatTotals } from "./stats";

const tot = (points: number, darts: number, extra: Partial<StatTotals> = {}): StatTotals => ({
  ...EMPTY_TOTALS,
  points,
  darts,
  ...extra,
});

const T1 = { id: "t1", name: "Event #1", date: "2025-12-01", finishedAt: "2025-12-01T20:00:00Z", matches: 3 };
const T2 = { id: "t2", name: "Event #2", date: "2026-03-01", finishedAt: "2026-03-01T20:00:00Z", matches: 3 };

const elo: EloRow[] = [
  { tournamentId: "t1", playerId: "a", ratingBefore: 1500, ratingAfter: 1516, playedAt: "2025-12-01T18:00:00Z" },
  { tournamentId: "t1", playerId: "b", ratingBefore: 1500, ratingAfter: 1484, playedAt: "2025-12-01T18:00:00Z" },
  { tournamentId: "t2", playerId: "a", ratingBefore: 1516, ratingAfter: 1530, playedAt: "2026-03-01T18:00:00Z" },
  { tournamentId: "t2", playerId: "a", ratingBefore: 1530, ratingAfter: 1512, playedAt: "2026-03-01T19:00:00Z" },
  { tournamentId: "t2", playerId: "b", ratingBefore: 1484, ratingAfter: 1502, playedAt: "2026-03-01T19:00:00Z" },
];

const data: RankingData = {
  tournaments: [T1, T2],
  results: [
    { tournamentId: "t1", playerId: "a", place: 1, points: 100 },
    { tournamentId: "t1", playerId: "b", place: 2, points: 75 },
    { tournamentId: "t1", playerId: "c", place: 3, points: 60 },
    { tournamentId: "t2", playerId: "b", place: 1, points: 100 },
    { tournamentId: "t2", playerId: "a", place: 2, points: 75 },
    { tournamentId: "t2", playerId: "c", place: 3, points: 60 },
  ],
  stats: [
    { tournamentId: "t1", playerId: "a", totals: tot(600, 30, { t180: 1, highestCheckout: 100 }) },
    { tournamentId: "t1", playerId: "b", totals: tot(500, 30) },
    { tournamentId: "t2", playerId: "a", totals: tot(400, 30, { highestCheckout: 121 }) },
    { tournamentId: "t2", playerId: "b", totals: tot(450, 30, { t180: 2 }) },
  ],
  eloHistory: elo,
  currentElo: new Map([
    ["a", 1512],
    ["b", 1502],
  ]),
};

describe("rankingView (SPEC 4.10)", () => {
  it("all time: shared position on equal points, ordered by wins then average", () => {
    const v = rankingView(data, { kind: "all" });
    expect(v.rows.map((r) => [r.playerId, r.position, r.points])).toEqual([
      ["a", 1, 175], // avg 50 vs b 47.5
      ["b", 1, 175],
      ["c", 3, 120],
    ]);
    expect(v.rows[0]).toMatchObject({ wins: 1, bestFinish: 1, t180: 1, highestCheckout: 121, elo: 1512 });
  });

  it("movement compares with the ranking before the last tournament; Elo change is for that tournament", () => {
    const v = rankingView(data, { kind: "all" });
    const byId = new Map(v.rows.map((r) => [r.playerId, r]));
    expect(byId.get("a")!.movement).toEqual({ kind: "same" });
    expect(byId.get("b")!.movement).toEqual({ kind: "up", by: 1 });
    expect(byId.get("c")!.movement).toEqual({ kind: "same" });
    expect(byId.get("a")!.eloChange).toBe(-4);
    expect(byId.get("b")!.eloChange).toBe(18);
    expect(byId.get("c")!.eloChange).toBeNull();
  });

  it("summary and podium of the last tournament", () => {
    const v = rankingView(data, { kind: "all" });
    expect(v.summary).toEqual({ tournaments: 2, matches: 6, t180: 3, highestCheckout: { score: 121, playerId: "a" } });
    expect(v.last?.tournament.id).toBe("t2");
    expect(v.last?.podium.map((r) => r.playerId)).toEqual(["b", "a", "c"]);
  });

  it("a year only counts its tournaments; everyone is new after the first one", () => {
    const v = rankingView(data, { kind: "year", year: 2025 });
    expect(v.rows.map((r) => [r.playerId, r.position])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
    expect(v.rows.every((r) => r.movement.kind === "new")).toBe(true);
    expect(rankingView(data, { kind: "year", year: 2024 }).rows).toEqual([]);
    expect(rankingView(data, { kind: "year", year: 2024 }).last).toBeNull();
    expect(rankingYears(data.tournaments)).toEqual([2026, 2025]);
  });

  it("tournamentEloChange spans first to last match", () => {
    expect(tournamentEloChange(elo, "a", "t2")).toBe(-4);
    expect(tournamentEloChange(elo, "c", "t2")).toBeNull();
  });
});

describe("statsTable (tournament Stats tab)", () => {
  it("orders by average, skips players without visits, finds leaders", () => {
    const { rows, leaders } = statsTable({
      a: tot(300, 18, { t180: 1, highestCheckout: 80, bestLegDarts: 15 }),
      b: tot(300, 15, { highestCheckout: 120, bestLegDarts: 18 }),
      c: tot(0, 0),
      d: tot(90, 9, { checkouts: 1, dartsAtDouble: 4 }),
    });
    expect(rows.map((r) => r.playerId)).toEqual(["b", "a", "d"]);
    expect(rows[2]!.checkoutPercent).toBe(25);
    expect(leaders).toEqual({
      average: { playerId: "b", value: 60 },
      t180: { playerId: "a", value: 1 },
      highestCheckout: { playerId: "b", value: 120 },
      bestLeg: { playerId: "a", value: 15 },
    });
    expect(statsTable({}).leaders.average).toBeNull();
  });
});

describe("playerProfile (SPEC 4.2)", () => {
  const matches: ProfileMatch[] = [
    { id: "m1", tournamentId: "t1", p1: "a", p2: "b", legsP1: 2, legsP2: 1, winnerId: "a", isManual: false, finishedAt: "2025-12-01T18:00:00Z", stage: "ko", groupIndex: null, round: 1 },
    { id: "m2", tournamentId: "t2", p1: "c", p2: "a", legsP1: 0, legsP2: 2, winnerId: "a", isManual: true, finishedAt: "2026-03-01T18:00:00Z", stage: "group", groupIndex: 0, round: 1 },
    { id: "m3", tournamentId: "t2", p1: "b", p2: "a", legsP1: 3, legsP2: 2, winnerId: "b", isManual: false, finishedAt: "2026-03-01T19:00:00Z", stage: "ko", groupIndex: null, round: 1 },
  ];
  const profile = (period = { kind: "all" } as const) =>
    playerProfile({ ...data, playerId: "a", matches }, period);

  it("header: position, points, Elo and the last tournament's change", () => {
    const p = profile();
    expect(p.ranking).toEqual({ position: 1, points: 175 });
    expect(p.elo).toBe(1512);
    expect(p.eloChange).toBe(-4);
  });

  it("tiles combine stats and records; fallback matches count for W–L only", () => {
    const t = profile().tiles;
    expect(t.average).toBeCloseTo((1000 / 60) * 3);
    expect(t.t180).toBe(1);
    expect(t.highestCheckout).toBe(121);
    expect(t.record).toEqual({ matches: { won: 2, lost: 1 }, legs: { won: 6, lost: 4 } });
    expect(t.wins).toBe(1);
    expect(t.bestFinish).toBe(1);
  });

  it("a period narrows the tiles", () => {
    const t = playerProfile({ ...data, playerId: "a", matches }, { kind: "year", year: 2026 }).tiles;
    expect(t.average).toBeCloseTo(40);
    expect(t.record.matches).toEqual({ won: 1, lost: 1 });
    expect(t.wins).toBe(0);
    expect(t.bestFinish).toBe(2);
  });

  it("charts, history, recent matches and head-to-head", () => {
    const p = profile();
    expect(p.eloSeries.map((e) => e.rating)).toEqual([1500, 1516, 1512]);
    expect(p.averageSeries.map((e) => Math.round(e.average))).toEqual([60, 40]);
    expect(p.history.map((h) => [h.tournament.id, h.place, h.points, h.t180])).toEqual([
      ["t2", 2, 75, 0],
      ["t1", 1, 100, 1],
    ]);
    expect(p.recent.map((m) => [m.id, m.opponentId, m.won])).toEqual([
      ["m3", "b", false],
      ["m2", "c", true],
      ["m1", "b", true],
    ]);
    expect(p.headToHead).toEqual([
      { opponentId: "b", won: 1, lost: 1 },
      { opponentId: "c", won: 1, lost: 0 },
    ]);
  });

  it("a player without results has an empty profile", () => {
    const p = playerProfile({ ...data, playerId: "z", matches: [] }, { kind: "all" });
    expect(p.ranking).toBeNull();
    expect(p.tiles.average).toBeNull();
    expect(p.tiles.bestFinish).toBeNull();
    expect(p.eloSeries).toEqual([]);
    expect(p.history).toEqual([]);
  });
});
