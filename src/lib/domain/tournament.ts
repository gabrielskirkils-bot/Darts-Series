// Tournament planning: the draw on create/redraw, knockout from group tables, progress.
// Pure: randomness comes in as an Rng, the caller writes the plan in one transaction.

import {
  advanceWinner,
  editKnockoutWinner,
  generateKnockout,
  seedsFromGroups,
  type KoMatch,
  type Knockout,
  type SeededPlayer,
  type SlotUpdate,
} from "./bracket";
import { manualResultWinner } from "./match";
import { groupsKnockoutPlaces, knockoutPlaces, roundRobinPlaces, type Placement } from "./placements";
import { pointsForPlace, type PointsRow } from "./points";
import {
  groupStandings,
  orderEntrants,
  scheduleGroupMatches,
  snakeDraw,
  type ResultMatch,
  type Rng,
  type Seeding,
  type StandingRow,
} from "./groups";
import { knockoutSortOrder } from "./queue";
import { DEFAULT_SETTINGS, validateSettings } from "./settings";
import {
  previewStructure,
  validateStructure,
  type Format,
  type MatchFormats,
  type StageFormat,
  type Structure,
  type StructureError,
} from "./structure";

export type TournamentStatus = "groups" | "ko" | "done";

export type MatchStage = "group" | "ko" | "third";
export type MatchStatus = "pending" | "live" | "done";

/** A match row to insert. */
export type MatchPlan = {
  stage: MatchStage;
  groupIndex: number | null;
  round: number;
  slot: number;
  sortOrder: number;
  p1: string | null;
  p2: string | null;
  startScore: number;
  bestOf: number;
  status: "pending" | "done";
  winnerId: string | null;
  isBye: boolean;
};

export type EntrantPlan = { playerId: string; seed: number; groupIndex: number | null };

export type KoMeta = { rounds: number; size: number; qualified: number; third: boolean };

export type DrawConfig = {
  format: Format;
  groupCount: number;
  thirdPlace: boolean;
  seeding: Seeding;
  formats: MatchFormats;
};

export type DrawPlan = {
  status: "groups" | "ko";
  players: EntrantPlan[];
  matches: MatchPlan[];
  ko: KoMeta | null;
};

/** Format for a knockout match: the final uses the final format, everything else knockout. */
export function knockoutFormat(
  stage: "ko" | "third",
  round: number,
  rounds: number,
  formats: MatchFormats,
): StageFormat {
  return stage === "ko" && round === rounds ? formats.final : formats.ko;
}

export function knockoutPlans(ko: Knockout, formats: MatchFormats): MatchPlan[] {
  return ko.matches.map((m: KoMatch) => {
    const f = knockoutFormat(m.stage, m.round, ko.rounds, formats);
    return {
      stage: m.stage,
      groupIndex: null,
      round: m.round,
      slot: m.slot,
      sortOrder: knockoutSortOrder(m.stage, m.round, m.slot, ko.rounds),
      p1: m.p1,
      p2: m.p2,
      startScore: f.start,
      bestOf: f.bestOf,
      status: m.status === "done" ? "done" : "pending",
      winnerId: m.winnerId,
      isBye: m.isBye,
    };
  });
}

function koMeta(ko: Knockout): KoMeta {
  return { rounds: ko.rounds, size: ko.size, qualified: ko.qualified, third: ko.third };
}

/** Reads the stored `ko` JSON; null when missing or malformed. */
export function parseKoMeta(value: unknown): KoMeta | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const int = (x: unknown) => (typeof x === "number" && Number.isInteger(x) && x >= 0 ? x : null);
  const rounds = int(v.rounds);
  const size = int(v.size);
  const qualified = int(v.qualified);
  if (rounds === null || size === null || qualified === null || rounds < 1) return null;
  return { rounds, size, qualified, third: v.third === true };
}

/** Stored structure: round robin is one group with no qualifiers; knockout only has no groups. */
export function normalizeStructure(s: Structure): Structure {
  if (s.format === "rr") return { format: "rr", groupCount: 1, advance: 0, thirdPlace: false };
  if (s.format === "ko") return { format: "ko", groupCount: 1, advance: 0, thirdPlace: s.thirdPlace };
  return { ...s };
}

/**
 * The draw when a tournament is created (or groups are redrawn): entrants sorted by Elo
 * or shuffled, split into groups by snake, all group matches scheduled. "Knockout only"
 * generates the whole bracket at once.
 */
export function planDraw(entrants: readonly { playerId: string; elo: number }[], config: DrawConfig, rng: Rng): DrawPlan {
  const ordered = orderEntrants(entrants, config.seeding, rng).map((e) => e.playerId);

  if (config.format === "ko") {
    const seeds: SeededPlayer[] = ordered.map((playerId) => ({ playerId, group: null }));
    const ko = generateKnockout(seeds, 1, config.thirdPlace);
    return {
      status: "ko",
      players: ordered.map((playerId, i) => ({ playerId, seed: i + 1, groupIndex: null })),
      matches: knockoutPlans(ko, config.formats),
      ko: koMeta(ko),
    };
  }

  const groupCount = config.format === "rr" ? 1 : config.groupCount;
  const groups = snakeDraw(ordered, groupCount);
  const groupOf = new Map<string, number>();
  groups.forEach((g, gi) => g.forEach((id) => groupOf.set(id, gi)));

  return {
    status: "groups",
    players: ordered.map((playerId, i) => ({ playerId, seed: i + 1, groupIndex: groupOf.get(playerId)! })),
    matches: scheduleGroupMatches(groups).map((m) => ({
      stage: "group",
      groupIndex: m.groupIndex,
      round: m.round,
      slot: 0,
      sortOrder: m.sortOrder,
      p1: m.p1,
      p2: m.p2,
      startScore: config.formats.group.start,
      bestOf: config.formats.group.bestOf,
      status: "pending",
      winnerId: null,
      isBye: false,
    })),
    ko: null,
  };
}

// ---------------------------------------------------------------
// Group tables and the knockout start
// ---------------------------------------------------------------

export type EntrantRow = { playerId: string; seed: number; groupIndex: number | null };

export type MatchRow = {
  id: string;
  stage: MatchStage;
  groupIndex: number | null;
  round: number;
  slot: number;
  sortOrder: number;
  p1: string | null;
  p2: string | null;
  legsP1: number;
  legsP2: number;
  winnerId: string | null;
  status: MatchStatus;
  isBye: boolean;
  isManual: boolean;
  bestOf: number;
  startScore: number;
  board: number | null;
  /** ISO timestamp, set once the match is done. */
  finishedAt?: string | null;
};

/** The most recently finished real matches (byes left out), newest first. */
export function latestResults(matches: readonly MatchRow[], limit: number): MatchRow[] {
  return matches
    .filter((m) => m.status === "done" && !m.isBye && m.winnerId)
    .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "") || b.sortOrder - a.sortOrder)
    .slice(0, limit);
}

/** One table per group (A, B, …) from finished group matches. Players listed by seed. */
export function groupTables(
  entrants: readonly EntrantRow[],
  matches: readonly MatchRow[],
  groupCount: number,
  averages: ReadonlyMap<string, number | null> = new Map(),
): StandingRow[][] {
  return Array.from({ length: groupCount }, (_, g) => {
    const ids = entrants
      .filter((e) => e.groupIndex === g)
      .sort((a, b) => a.seed - b.seed)
      .map((e) => e.playerId);
    const results: ResultMatch[] = matches
      .filter((m) => m.stage === "group" && m.groupIndex === g && m.status === "done" && m.p1 && m.p2)
      .map((m) => ({ p1: m.p1!, p2: m.p2!, legsP1: m.legsP1, legsP2: m.legsP2, winnerId: m.winnerId }));
    return groupStandings(ids, results, averages);
  });
}

export function groupMatches(matches: readonly MatchRow[]): MatchRow[] {
  return matches.filter((m) => m.stage === "group");
}

/** Groups can be redrawn while no group match has started. */
export function canRedrawGroups(status: string, matches: readonly MatchRow[]): boolean {
  const group = groupMatches(matches);
  return status === "groups" && group.length > 0 && group.every((m) => m.status === "pending");
}

/** "Start knockout" once every group match is done (groups + knockout format only). */
export function canStartKnockout(format: Format, status: string, matches: readonly MatchRow[]): boolean {
  if (format !== "groups_ko" || status !== "groups") return false;
  const group = groupMatches(matches);
  return group.length > 0 && group.every((m) => m.status === "done");
}

/** Bracket from final group tables. */
export function planKnockoutFromGroups(
  tables: readonly (readonly StandingRow[])[],
  advance: number,
  thirdPlace: boolean,
  formats: MatchFormats,
): { matches: MatchPlan[]; ko: KoMeta } {
  const seeds = seedsFromGroups(tables, advance);
  const ko = generateKnockout(seeds, tables.length, thirdPlace);
  return { matches: knockoutPlans(ko, formats), ko: koMeta(ko) };
}

/** MatchRow → bracket model, for advancement and edits. */
export function toKoMatch(m: MatchRow): KoMatch {
  return {
    stage: m.stage === "third" ? "third" : "ko",
    round: m.round,
    slot: m.slot,
    p1: m.p1,
    p2: m.p2,
    isBye: m.isBye,
    winnerId: m.winnerId,
    status: m.status,
  };
}

// ---------------------------------------------------------------
// Wizard input
// ---------------------------------------------------------------

export type TournamentInput = {
  name: string;
  date: string;
  playerIds: string[];
  structure: { format: Format; groupCount: number; advance: number; thirdPlace: boolean };
  seeding: Seeding;
  formats: MatchFormats;
  boards: number;
};

export type TournamentInputError =
  | "nameRequired"
  | "nameTooLong"
  | "dateInvalid"
  | "duplicatePlayers"
  | "boardsInvalid"
  | StructureError
  | "formatInvalid";

export const TOURNAMENT_NAME_MAX = 80;

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Shape check for input arriving from the client (Server Action arguments are untrusted).
 * Returns null when the shape is wrong; value rules are checked by validateTournamentInput.
 */
export function parseTournamentInput(raw: unknown): TournamentInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const s = r.structure as Record<string, unknown> | null | undefined;
  const f = r.formats as Record<string, unknown> | null | undefined;
  const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
  const stage = (x: unknown): StageFormat | null => {
    if (typeof x !== "object" || x === null) return null;
    const o = x as Record<string, unknown>;
    return isNum(o.start) && isNum(o.bestOf) ? { start: o.start, bestOf: o.bestOf } : null;
  };
  if (typeof r.name !== "string" || typeof r.date !== "string") return null;
  if (!Array.isArray(r.playerIds) || !r.playerIds.every((id) => typeof id === "string")) return null;
  if (!s || typeof s !== "object" || !f || typeof f !== "object") return null;
  if (s.format !== "groups_ko" && s.format !== "ko" && s.format !== "rr") return null;
  if (!isNum(s.groupCount) || !isNum(s.advance) || typeof s.thirdPlace !== "boolean") return null;
  if (r.seeding !== "elo" && r.seeding !== "random") return null;
  if (!isNum(r.boards)) return null;
  const group = stage(f.group);
  const ko = stage(f.ko);
  const final = stage(f.final);
  if (!group || !ko || !final) return null;
  return {
    name: r.name,
    date: r.date,
    playerIds: r.playerIds as string[],
    structure: { format: s.format, groupCount: s.groupCount, advance: s.advance, thirdPlace: s.thirdPlace },
    seeding: r.seeding,
    formats: { group, ko, final },
    boards: r.boards,
  };
}

/** Everything the wizard must check before creating (structure rules from SPEC 4.3). */
export function validateTournamentInput(input: TournamentInput): TournamentInputError[] {
  const errors: TournamentInputError[] = [];
  const name = input.name.trim();
  if (!name) errors.push("nameRequired");
  if (name.length > TOURNAMENT_NAME_MAX) errors.push("nameTooLong");
  if (!isIsoDate(input.date)) errors.push("dateInvalid");
  if (new Set(input.playerIds).size !== input.playerIds.length) errors.push("duplicatePlayers");
  if (!Number.isInteger(input.boards) || input.boards < 1 || input.boards > 8) errors.push("boardsInvalid");
  errors.push(...validateStructure(input.playerIds.length, input.structure));
  const formatErrors = validateSettings({ ...DEFAULT_SETTINGS, fmt: input.formats });
  if (formatErrors.includes("formatInvalid")) errors.push("formatInvalid");
  return errors;
}

// ---------------------------------------------------------------
// Progress
// ---------------------------------------------------------------

/**
 * Matches done / total, byes excluded. Before the knockout exists, `expectedKnockout`
 * (from the structure preview) stands in for its matches.
 */
export function tournamentProgress(
  matches: readonly MatchRow[],
  expectedKnockout: number,
): { done: number; total: number } {
  const real = matches.filter((m) => !m.isBye);
  const hasKnockout = matches.some((m) => m.stage !== "group");
  const done = real.filter((m) => m.status === "done").length;
  return { done, total: real.length + (hasKnockout ? 0 : expectedKnockout) };
}

// ---------------------------------------------------------------
// Views: bracket columns and match lists
// ---------------------------------------------------------------

/** Knockout matches per round (1 … rounds), each ordered by slot, plus the third-place match. */
export function bracketColumns(
  matches: readonly MatchRow[],
  rounds: number,
): { columns: MatchRow[][]; third: MatchRow | null } {
  const columns = Array.from({ length: rounds }, (_, i) =>
    matches.filter((m) => m.stage === "ko" && m.round === i + 1).sort((a, b) => a.slot - b.slot),
  );
  return { columns, third: matches.find((m) => m.stage === "third") ?? null };
}

/** Live (by board), waiting (by sort order) and finished (latest first) matches; byes left out. */
export function matchBuckets(matches: readonly MatchRow[]): {
  live: MatchRow[];
  waiting: MatchRow[];
  finished: MatchRow[];
} {
  const real = matches.filter((m) => !m.isBye);
  return {
    live: real.filter((m) => m.status === "live").sort((a, b) => (a.board ?? 99) - (b.board ?? 99)),
    waiting: real.filter((m) => m.status === "pending").sort((a, b) => a.sortOrder - b.sortOrder),
    finished: real.filter((m) => m.status === "done").sort((a, b) => b.sortOrder - a.sortOrder),
  };
}

export type OverviewInput = {
  format: Format;
  status: TournamentStatus;
  groupCount: number;
  advance: number;
  thirdPlace: boolean;
  boards: number;
  fmt: MatchFormats;
  ko: KoMeta | null;
  entrants: readonly EntrantRow[];
  matches: readonly MatchRow[];
  averages: Readonly<Record<string, number | null>>;
};

export type TournamentOverview = {
  /** Knockout rounds (planned until the knockout exists), 0 without a knockout. */
  rounds: number;
  progress: { done: number; total: number };
  /** Group tables (one for round robin, none for knockout only). */
  tables: StandingRow[][];
  /** Rows per group that qualify (0 = nobody highlighted). */
  qualifiers: number;
  canRedraw: boolean;
  canStartKnockout: boolean;
  bracket: { columns: MatchRow[][]; third: MatchRow | null };
  buckets: { live: MatchRow[]; waiting: MatchRow[]; finished: MatchRow[] };
};

/** Everything the tournament page shows that has to be derived from the stored rows. */
export function tournamentOverview(t: OverviewInput): TournamentOverview {
  const structure = { format: t.format, groupCount: t.groupCount, advance: t.advance, thirdPlace: t.thirdPlace };
  const preview = previewStructure(t.entrants.length, structure, t.fmt, t.boards);
  const rounds = t.ko?.rounds ?? preview.rounds;
  const averages = new Map(Object.entries(t.averages));
  return {
    rounds,
    progress: tournamentProgress(t.matches, preview.knockoutMatches),
    tables:
      t.format === "ko" ? [] : groupTables(t.entrants, t.matches, t.format === "rr" ? 1 : t.groupCount, averages),
    qualifiers: t.format === "groups_ko" ? t.advance : 0,
    canRedraw: t.format !== "ko" && canRedrawGroups(t.status, t.matches),
    canStartKnockout: canStartKnockout(t.format, t.status, t.matches),
    bracket: bracketColumns(t.matches, t.ko?.rounds ?? 0),
    buckets: matchBuckets(t.matches),
  };
}

// ---------------------------------------------------------------
// Finishing (SPEC 4.9)
// ---------------------------------------------------------------

export type FinishBlocker = "alreadyFinished" | "matchesUnfinished" | "knockoutMissing";

/** Why the tournament can't be finished yet, or null when it can. */
export function finishBlocker(
  format: Format,
  status: TournamentStatus,
  matches: readonly MatchRow[],
): FinishBlocker | null {
  if (status === "done") return "alreadyFinished";
  if (format === "groups_ko" && status !== "ko") return "knockoutMissing";
  if (matches.length === 0 || matches.some((m) => !m.isBye && m.status !== "done")) return "matchesUnfinished";
  return null;
}

export type ResultRow = { playerId: string; place: number; points: number };

/**
 * Final places for every entrant (round robin: table; knockout: bracket; groups + knockout:
 * bracket, then group-eliminated players by group position) with points from the table.
 */
export function finalResults(
  t: {
    format: Format;
    groupCount: number;
    advance: number;
    ko: KoMeta | null;
    entrants: readonly EntrantRow[];
    matches: readonly MatchRow[];
    averages?: Readonly<Record<string, number | null>>;
  },
  pointsTable: readonly PointsRow[],
): ResultRow[] {
  const averages = new Map(Object.entries(t.averages ?? {}));
  const ko = t.matches.filter((m) => m.stage !== "group").map(toKoMatch);
  const rounds = t.ko?.rounds ?? 0;
  let places: Placement[];
  if (t.format === "rr") {
    places = roundRobinPlaces(groupTables(t.entrants, t.matches, 1, averages)[0] ?? []);
  } else if (t.format === "ko") {
    places = knockoutPlaces(ko, rounds);
  } else {
    places = groupsKnockoutPlaces(groupTables(t.entrants, t.matches, t.groupCount, averages), t.advance, ko, rounds);
  }
  return places
    .map((p) => ({ playerId: p.playerId, place: p.place, points: pointsForPlace(p.place, pointsTable) }))
    .sort((a, b) => a.place - b.place);
}

// ---------------------------------------------------------------
// Confirming a scored match (SPEC 4.7 step 6)
// ---------------------------------------------------------------

/**
 * Where a confirmed live match sends its players: the winner to the next round, a
 * semi-final loser to the third-place match (if there is one). Group matches go nowhere.
 */
export function planConfirm(
  matches: readonly MatchRow[],
  matchId: string,
  winnerSide: 0 | 1,
  rounds: number | null,
): { winnerId: string; slots: SlotUpdate[] } | null {
  const match = matches.find((m) => m.id === matchId);
  if (!match || match.status !== "live" || !match.p1 || !match.p2) return null;
  const winnerId = winnerSide === 0 ? match.p1 : match.p2;
  const loserId = winnerSide === 0 ? match.p2 : match.p1;
  if (match.stage === "group" || rounds === null) return { winnerId, slots: [] };
  const hasThird = matches.some((m) => m.stage === "third");
  return { winnerId, slots: advanceWinner(toKoMatch(match), winnerId, loserId, rounds, hasThird) };
}

// ---------------------------------------------------------------
// Fallback result entry (SPEC 4.7)
// ---------------------------------------------------------------

/**
 * Whether the organizer may enter (or edit) a leg score on the tournament page: both players
 * known, not a bye, not live, not scored visit by visit, group matches only during the group
 * stage, nothing once the tournament is finished.
 */
export function canEnterResult(match: MatchRow, status: TournamentStatus): boolean {
  if (status === "done" || match.isBye || !match.p1 || !match.p2) return false;
  if (match.stage === "group" && status !== "groups") return false;
  return match.status === "pending" || (match.status === "done" && match.isManual);
}

export type ManualResultError = "notEditable" | "invalidScore" | "nextMatchStarted";

export type ManualResultPlan =
  | { ok: true; winnerId: string; slots: SlotUpdate[] }
  | { ok: false; error: ManualResultError };

/**
 * Winner and knockout advancement for a fallback result. A changed knockout winner rewrites
 * the next match (and third-place match) only while those are still pending.
 */
export function planManualResult(
  matches: readonly MatchRow[],
  matchId: string,
  status: TournamentStatus,
  legsP1: number,
  legsP2: number,
  rounds: number | null,
): ManualResultPlan {
  const match = matches.find((m) => m.id === matchId);
  if (!match || !canEnterResult(match, status)) return { ok: false, error: "notEditable" };
  const side = manualResultWinner(match.bestOf, legsP1, legsP2);
  if (side === null) return { ok: false, error: "invalidScore" };
  const winnerId = side === 0 ? match.p1! : match.p2!;

  if (match.stage === "group" || rounds === null) return { ok: true, winnerId, slots: [] };
  if (match.status === "done" && match.winnerId === winnerId) return { ok: true, winnerId, slots: [] };

  const ko = matches.filter((m) => m.stage !== "group").map(toKoMatch);
  const edit = editKnockoutWinner(ko, toKoMatch(match), winnerId, rounds);
  if (!edit.ok) return { ok: false, error: "nextMatchStarted" };
  return { ok: true, winnerId, slots: edit.updates };
}
