// Tournament structure: auto-suggestion, validation, preview and duration (SPEC section 4.3).

import { snakeGroupSizes } from "./groups";
import { bracketSize, roundCount, semiFinalHasBye } from "./bracket";

export type Format = "groups_ko" | "ko" | "rr";

export type StageFormat = { start: number; bestOf: number };
export type MatchFormats = { group: StageFormat; ko: StageFormat; final: StageFormat };

export const DEFAULT_FORMATS: MatchFormats = {
  group: { start: 301, bestOf: 3 },
  ko: { start: 501, bestOf: 5 },
  final: { start: 501, bestOf: 7 },
};

export type Structure = {
  format: Format;
  /** Number of groups G (1 for round robin, ignored for knockout only). */
  groupCount: number;
  /** Qualifiers per group A (0 for round robin). */
  advance: number;
  thirdPlace: boolean;
};

/** Suggested structure for n entrants. */
export function suggestStructure(n: number): Structure {
  if (n <= 3) return { format: "rr", groupCount: 1, advance: 0, thirdPlace: false };
  if (n <= 5) return { format: "groups_ko", groupCount: 1, advance: 2, thirdPlace: false };
  return {
    format: "groups_ko",
    groupCount: Math.max(2, Math.round(n / 4)),
    advance: 2,
    thirdPlace: false,
  };
}

export type StructureError =
  | "tooFewPlayers"
  | "groupTooSmall"
  | "advanceTooHigh"
  | "advanceOutOfRange"
  | "knockoutTooSmall";

/** Validation errors for a structure with n entrants; empty when valid. */
export function validateStructure(n: number, s: Structure): StructureError[] {
  const errors: StructureError[] = [];
  if (n < 2) return ["tooFewPlayers"];
  if (s.format === "rr" || s.format === "ko") return errors;

  if (s.groupCount < 1 || n < s.groupCount * 2) errors.push("groupTooSmall");
  if (s.advance < 1 || s.advance > 4) errors.push("advanceOutOfRange");
  const sizes = s.groupCount >= 1 ? snakeGroupSizes(n, s.groupCount) : [];
  const smallest = sizes.length ? Math.min(...sizes) : 0;
  if (s.advance > smallest) errors.push("advanceTooHigh");
  if (s.groupCount * s.advance < 2) errors.push("knockoutTooSmall");
  return errors;
}

/** Number of players entering the knockout (0 for round robin). */
export function qualifiedCount(n: number, s: Structure): number {
  if (s.format === "rr") return 0;
  if (s.format === "ko") return n;
  return s.groupCount * s.advance;
}

// ---------------------------------------------------------------
// Match counts and duration
// ---------------------------------------------------------------

const MINUTES_PER_LEG: Record<number, number> = { 301: 4.5, 501: 7, 701: 10 };
const CHANGEOVER_MINUTES = 1.5;

export function expectedLegs(bestOf: number): number {
  if (bestOf <= 1) return 1;
  return (bestOf + 1) / 2 + ((bestOf - 1) / 2) * 0.6;
}

export function matchMinutes(f: StageFormat): number {
  const perLeg = MINUTES_PER_LEG[f.start] ?? MINUTES_PER_LEG[501];
  return expectedLegs(f.bestOf) * perLeg + CHANGEOVER_MINUTES;
}

function roundRobinMatches(size: number): number {
  return (size * (size - 1)) / 2;
}

export type Preview = {
  /** Group sizes in group order (A, B, …); a single group for round robin; empty for knockout only. */
  groupSizes: number[];
  qualified: number;
  bracketSize: number;
  byes: number;
  /** Number of knockout rounds, 0 without a knockout. */
  rounds: number;
  hasThirdPlace: boolean;
  groupMatches: number;
  knockoutMatches: number;
  totalMatches: number;
  groupMinutes: number;
  knockoutMinutes: number;
  totalMinutes: number;
};

/** Live wizard preview: sizes, bracket, match count and estimated duration. */
export function previewStructure(
  n: number,
  s: Structure,
  formats: MatchFormats,
  boards: number,
): Preview {
  const b = Math.max(1, boards);
  const groupSizes =
    s.format === "ko" ? [] : s.format === "rr" ? [n] : snakeGroupSizes(n, s.groupCount);
  const groupMatches = groupSizes.reduce((sum, size) => sum + roundRobinMatches(size), 0);
  const groupMinutes = (groupMatches * matchMinutes(formats.group)) / b;

  const qualified = qualifiedCount(n, s);
  const hasKnockout = qualified >= 2;
  const size = hasKnockout ? bracketSize(qualified) : 0;
  const rounds = hasKnockout ? roundCount(size) : 0;
  const byes = hasKnockout ? size - qualified : 0;
  const hasThirdPlace = hasKnockout && s.thirdPlace && rounds >= 2 && !semiFinalHasBye(size, qualified);

  let knockoutMinutes = 0;
  if (hasKnockout) {
    const koTime = matchMinutes(formats.ko);
    const finalTime = matchMinutes(formats.final);
    for (let r = 1; r < rounds; r++) {
      const pairs = size / 2 ** r;
      const real = r === 1 ? pairs - byes : pairs;
      knockoutMinutes += Math.ceil(real / b) * koTime;
    }
    if (hasThirdPlace) {
      knockoutMinutes += b >= 2 ? Math.max(finalTime, koTime) : finalTime + koTime;
    } else {
      knockoutMinutes += finalTime;
    }
  }

  const knockoutMatches = hasKnockout ? qualified - 1 + (hasThirdPlace ? 1 : 0) : 0;
  return {
    groupSizes,
    qualified,
    bracketSize: size,
    byes,
    rounds,
    hasThirdPlace,
    groupMatches,
    knockoutMatches,
    totalMatches: groupMatches + knockoutMatches,
    groupMinutes: Math.round(groupMinutes),
    knockoutMinutes: Math.round(knockoutMinutes),
    totalMinutes: Math.round(groupMinutes + knockoutMinutes),
  };
}
