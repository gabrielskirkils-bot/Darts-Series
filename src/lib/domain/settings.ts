// App settings (SPEC section 4.14), stored as JSON in the single settings row.

import { DEFAULT_ELO } from "./elo";
import { DEFAULT_POINTS, type PointsRow } from "./points";
import { BEST_OF_OPTIONS, START_SCORES } from "./rules";
import { DEFAULT_FORMATS, type MatchFormats, type StageFormat } from "./structure";

export type AppSettings = {
  points: PointsRow[];
  /** K per match. */
  eloK: number;
  /** K for the final placing of each tournament. */
  eloPlaceK: number;
  eloStart: number;
  boards: number;
  askDoubles: boolean;
  fmt: MatchFormats;
};

export const DEFAULT_SETTINGS: AppSettings = {
  points: DEFAULT_POINTS,
  eloK: DEFAULT_ELO.k,
  eloPlaceK: DEFAULT_ELO.placeK,
  eloStart: DEFAULT_ELO.start,
  boards: 2,
  askDoubles: true,
  fmt: DEFAULT_FORMATS,
};

export const LIMITS = {
  eloK: { min: 1, max: 100 },
  eloPlaceK: { min: 0, max: 200 },
  eloStart: { min: 100, max: 3000 },
  boards: { min: 1, max: 8 },
  place: { min: 1, max: 1000 },
  pts: { min: 0, max: 10000 },
  pointsRows: { max: 30 },
} as const;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function stage(v: unknown, fallback: StageFormat): StageFormat {
  if (!isObj(v)) return { ...fallback };
  return { start: num(v.start, fallback.start), bestOf: num(v.bestOf, fallback.bestOf) };
}

/** Reads the stored JSON, filling anything missing or malformed with defaults. */
export function parseSettings(data: unknown): AppSettings {
  const d = isObj(data) ? data : {};
  const fmt = isObj(d.fmt) ? d.fmt : {};
  const points = Array.isArray(d.points)
    ? d.points
        .filter(isObj)
        .map((r) => ({ place: num(r.place, NaN), pts: num(r.pts, NaN) }))
        .filter((r) => Number.isFinite(r.place) && Number.isFinite(r.pts))
    : null;
  return {
    points: points && points.length ? sortPointsRows(points) : DEFAULT_SETTINGS.points.map((r) => ({ ...r })),
    eloK: num(d.eloK, DEFAULT_SETTINGS.eloK),
    eloPlaceK: num(d.eloPlaceK, DEFAULT_SETTINGS.eloPlaceK),
    eloStart: num(d.eloStart, DEFAULT_SETTINGS.eloStart),
    boards: num(d.boards, DEFAULT_SETTINGS.boards),
    askDoubles: typeof d.askDoubles === "boolean" ? d.askDoubles : DEFAULT_SETTINGS.askDoubles,
    fmt: {
      group: stage(fmt.group, DEFAULT_FORMATS.group),
      ko: stage(fmt.ko, DEFAULT_FORMATS.ko),
      final: stage(fmt.final, DEFAULT_FORMATS.final),
    },
  };
}

export function sortPointsRows(rows: readonly PointsRow[]): PointsRow[] {
  return [...rows].sort((a, b) => a.place - b.place);
}

export type SettingsError =
  | "pointsEmpty"
  | "pointsTooMany"
  | "placeInvalid"
  | "placeDuplicate"
  | "ptsInvalid"
  | "eloKInvalid"
  | "eloPlaceKInvalid"
  | "eloStartInvalid"
  | "boardsInvalid"
  | "formatInvalid";

function intIn(v: number, min: number, max: number): boolean {
  return Number.isInteger(v) && v >= min && v <= max;
}

/** Validation errors (empty when valid). */
export function validateSettings(s: AppSettings): SettingsError[] {
  const errors = new Set<SettingsError>();
  if (s.points.length === 0) errors.add("pointsEmpty");
  if (s.points.length > LIMITS.pointsRows.max) errors.add("pointsTooMany");
  const places = new Set<number>();
  for (const r of s.points) {
    if (!intIn(r.place, LIMITS.place.min, LIMITS.place.max)) errors.add("placeInvalid");
    if (places.has(r.place)) errors.add("placeDuplicate");
    places.add(r.place);
    if (!intIn(r.pts, LIMITS.pts.min, LIMITS.pts.max)) errors.add("ptsInvalid");
  }
  if (!intIn(s.eloK, LIMITS.eloK.min, LIMITS.eloK.max)) errors.add("eloKInvalid");
  if (!intIn(s.eloPlaceK, LIMITS.eloPlaceK.min, LIMITS.eloPlaceK.max)) errors.add("eloPlaceKInvalid");
  if (!intIn(s.eloStart, LIMITS.eloStart.min, LIMITS.eloStart.max)) errors.add("eloStartInvalid");
  if (!intIn(s.boards, LIMITS.boards.min, LIMITS.boards.max)) errors.add("boardsInvalid");
  for (const f of [s.fmt.group, s.fmt.ko, s.fmt.final]) {
    const okStart = (START_SCORES as readonly number[]).includes(f.start);
    const okBestOf = (BEST_OF_OPTIONS as readonly number[]).includes(f.bestOf);
    if (!okStart || !okBestOf) errors.add("formatInvalid");
  }
  return [...errors];
}
