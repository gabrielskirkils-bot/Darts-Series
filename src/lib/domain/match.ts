// Match state for the scoreboard: replays visits into legs, scores and whose turn it is.
// Undo = drop the last visit and replay, which also reopens a finished leg.

import { minCheckoutDarts } from "./checkout";
import { classifyVisit, legStarter, legsToWin, shouldAskDartsAtDouble } from "./rules";

export type Side = 0 | 1;

export type Visit = {
  legNo: number;
  seq: number;
  player: Side;
  score: number;
  darts: number;
  dartsAtDouble: number;
  bust: boolean;
  isCheckout: boolean;
};

export type MatchSetup = {
  startScore: number;
  bestOf: number;
  /** Who threw first in leg 1 (bull-up winner). */
  firstStarter: Side;
};

export type LegState = {
  legNo: number;
  starter: Side;
  winner: Side | null;
  visits: Visit[];
};

export type MatchState = {
  legs: LegState[];
  /** The leg in play, or the last leg once the match is over. */
  currentLeg: LegState;
  legsWon: [number, number];
  remaining: [number, number];
  dartsThisLeg: [number, number];
  toThrow: Side;
  winner: Side | null;
};

function other(side: Side): Side {
  return side === 0 ? 1 : 0;
}

/** Rebuilds the full match state from its visits (any order). */
export function matchState(setup: MatchSetup, visits: readonly Visit[]): MatchState {
  const sorted = [...visits].sort((a, b) => a.legNo - b.legNo || a.seq - b.seq);
  const needed = legsToWin(setup.bestOf);
  const legsWon: [number, number] = [0, 0];
  const legs: LegState[] = [];
  let winner: Side | null = null;

  const newLeg = (legNo: number): LegState => ({
    legNo,
    starter: legStarter(setup.firstStarter, legNo),
    winner: null,
    visits: [],
  });

  let current = newLeg(1);
  legs.push(current);

  for (const v of sorted) {
    if (winner !== null) break;
    while (v.legNo > current.legNo) {
      current = newLeg(current.legNo + 1);
      legs.push(current);
    }
    current.visits.push(v);
    if (v.isCheckout) {
      current.winner = v.player;
      legsWon[v.player] += 1;
      if (legsWon[v.player] >= needed) winner = v.player;
    }
  }

  // A finished leg with the match still running → the next leg is in play.
  if (winner === null && current.winner !== null) {
    current = newLeg(current.legNo + 1);
    legs.push(current);
  }

  const remaining: [number, number] = [setup.startScore, setup.startScore];
  const dartsThisLeg: [number, number] = [0, 0];
  for (const v of current.visits) {
    if (!v.bust) remaining[v.player] -= v.score;
    dartsThisLeg[v.player] += v.darts;
  }

  const last = current.visits.at(-1);
  const toThrow = last ? other(last.player) : current.starter;

  return { legs, currentLeg: current, legsWon, remaining, dartsThisLeg, toThrow, winner };
}

export type VisitPlan =
  | { kind: "invalid" }
  | { kind: "cantCheckout"; remaining: number }
  | { kind: "matchOver" }
  /** Ask "darts used" (minDarts…3) and "darts at double" (1…darts used). */
  | { kind: "checkout"; minDarts: 1 | 2 | 3 }
  /** Save immediately, or first ask "darts at double?" 0–3 when askDoubles is true. */
  | { kind: "save"; bust: boolean; askDoubles: boolean };

/** Decides what the scoreboard does with a typed visit total. */
export function planVisit(state: MatchState, score: number, askDoublesSetting: boolean): VisitPlan {
  if (state.winner !== null) return { kind: "matchOver" };
  const remaining = state.remaining[state.toThrow];
  const outcome = classifyVisit(remaining, score);
  switch (outcome.kind) {
    case "invalid":
      return { kind: "invalid" };
    case "cantCheckout":
      return { kind: "cantCheckout", remaining: outcome.remaining };
    case "checkout":
      return { kind: "checkout", minDarts: minCheckoutDarts(remaining) ?? 3 };
    case "bust":
    case "ok":
      return {
        kind: "save",
        bust: outcome.kind === "bust",
        askDoubles: shouldAskDartsAtDouble(remaining, outcome, askDoublesSetting),
      };
  }
}

export type VisitInput = {
  score: number;
  /** Required for a checkout; defaults to 3 otherwise. */
  darts?: number;
  dartsAtDouble?: number;
};

/**
 * Builds the visit row for the player to throw. Throws on input the scoreboard
 * should have rejected through `planVisit`.
 */
export function buildVisit(state: MatchState, input: VisitInput): Visit {
  if (state.winner !== null) throw new Error("Match is over");
  const player = state.toThrow;
  const remaining = state.remaining[player];
  const outcome = classifyVisit(remaining, input.score);
  if (outcome.kind === "invalid" || outcome.kind === "cantCheckout") {
    throw new Error(`Visit ${input.score} not allowed on ${remaining}`);
  }
  const isCheckout = outcome.kind === "checkout";
  const darts = isCheckout ? (input.darts ?? 3) : 3;
  const dartsAtDouble = input.dartsAtDouble ?? (isCheckout ? 1 : 0);

  if (isCheckout) {
    const min = minCheckoutDarts(remaining) ?? 3;
    if (darts < min || darts > 3) throw new Error(`Darts used must be ${min}–3`);
    if (dartsAtDouble < 1 || dartsAtDouble > darts) {
      throw new Error(`Darts at double must be 1–${darts}`);
    }
  } else if (dartsAtDouble < 0 || dartsAtDouble > 3) {
    throw new Error("Darts at double must be 0–3");
  }

  const leg = state.currentLeg;
  return {
    legNo: leg.legNo,
    seq: (leg.visits.at(-1)?.seq ?? 0) + 1,
    player,
    score: input.score,
    darts,
    dartsAtDouble,
    bust: outcome.kind === "bust",
    isCheckout,
  };
}

/**
 * Fallback entry (leg score only): the winning side if the legs form a finished
 * best-of-N result, otherwise null. E.g. bo5: 3–1 → 0, 2–3 → 1, 3–3 / 2–1 → null.
 */
export function manualResultWinner(bestOf: number, legsP1: number, legsP2: number): Side | null {
  const need = legsToWin(bestOf);
  const valid = (n: number) => Number.isInteger(n) && n >= 0;
  if (!valid(legsP1) || !valid(legsP2)) return null;
  if (legsP1 === need && legsP2 < need) return 0;
  if (legsP2 === need && legsP1 < need) return 1;
  return null;
}

/** The visit that undo deletes (the most recent one), or null if none. */
export function lastVisit(visits: readonly Visit[]): Visit | null {
  let last: Visit | null = null;
  for (const v of visits) {
    if (!last || v.legNo > last.legNo || (v.legNo === last.legNo && v.seq > last.seq)) last = v;
  }
  return last;
}
