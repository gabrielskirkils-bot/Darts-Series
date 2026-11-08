// X01 double-out rules (SPEC section 3).

export const START_SCORES = [301, 501, 701] as const;
export type StartScore = (typeof START_SCORES)[number];

export const BEST_OF_OPTIONS = [1, 3, 5, 7, 9] as const;

/** Visit totals that cannot be scored with three darts. */
export const IMPOSSIBLE_SCORES: ReadonlySet<number> = new Set([
  163, 166, 169, 172, 173, 175, 176, 178, 179,
]);

/** Scores of 170 or less that cannot be finished with a double in three darts. */
export const BOGEY_NUMBERS: ReadonlySet<number> = new Set([159, 162, 163, 165, 166, 168, 169]);

export const MAX_CHECKOUT = 170;

/** A visit total is valid if it is an integer 0–180 that three darts can score. */
export function isValidVisitScore(score: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= 180 && !IMPOSSIBLE_SCORES.has(score);
}

/** Whether `remaining` can be finished on a double at all. */
export function isFinishable(remaining: number): boolean {
  return (
    Number.isInteger(remaining) &&
    remaining >= 2 &&
    remaining <= MAX_CHECKOUT &&
    !BOGEY_NUMBERS.has(remaining)
  );
}

/** Whether a single dart can finish `remaining` (a double, or Bull). */
export function isOneDartFinish(remaining: number): boolean {
  return remaining === 50 || (remaining >= 2 && remaining <= 40 && remaining % 2 === 0);
}

export type VisitOutcome =
  | { kind: "invalid" }
  | { kind: "cantCheckout"; remaining: number }
  | { kind: "bust" }
  | { kind: "checkout" }
  | { kind: "ok"; remaining: number };

/**
 * Classifies a visit total against the score remaining before the visit.
 * - invalid: not a possible 3-dart total
 * - cantCheckout: score equals remaining, but remaining can't be finished on a double
 * - bust: score > remaining, or it would leave 1
 * - checkout: score equals a finishable remaining
 * - ok: normal scoring visit
 */
export function classifyVisit(remaining: number, score: number): VisitOutcome {
  if (!isValidVisitScore(score)) return { kind: "invalid" };
  if (score === remaining) {
    return isFinishable(remaining) ? { kind: "checkout" } : { kind: "cantCheckout", remaining };
  }
  if (score > remaining || remaining - score === 1) return { kind: "bust" };
  return { kind: "ok", remaining: remaining - score };
}

/** Legs needed to win a best-of-N match. */
export function legsToWin(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

/** Player (0 = p1, 1 = p2) who throws first in a leg; legs alternate. */
export function legStarter(firstStarter: 0 | 1, legNo: number): 0 | 1 {
  return ((firstStarter + legNo - 1) % 2) as 0 | 1;
}

/** Whether to show the "darts at double?" prompt for a non-checkout visit. */
export function shouldAskDartsAtDouble(
  remainingBefore: number,
  outcome: VisitOutcome,
  askDoublesSetting: boolean,
): boolean {
  if (!askDoublesSetting) return false;
  if (outcome.kind !== "ok" && outcome.kind !== "bust") return false;
  return remainingBefore <= 50 && isFinishable(remainingBefore);
}
