// Checkout suggestions (SPEC section 4.7): fewest darts, then preferred double, then cheapest setup.

import { isFinishable } from "./rules";

export type Segment = { label: string; value: number };

type CostedSegment = Segment & { cost: number };

/** Finishing doubles in order of preference. Bull is always last. */
const DOUBLE_PREFERENCE = [20, 16, 8, 18, 12, 10, 4, 14, 6, 19, 17, 15, 13, 11, 9, 7, 5, 3, 2, 1];

const FINISHING: CostedSegment[] = [
  ...DOUBLE_PREFERENCE.map((n, i) => ({ label: `D${n}`, value: n * 2, cost: i })),
  { label: "Bull", value: 50, cost: DOUBLE_PREFERENCE.length },
];

/** Setup darts: T20 < T19 < T18 < other trebles < big singles < 25 < Bull < doubles. */
const SETUP: CostedSegment[] = (() => {
  const list: CostedSegment[] = [];
  for (let n = 20; n >= 1; n--) {
    const trebleCost = n === 20 ? 0 : n === 19 ? 1 : n === 18 ? 2 : 3 + (20 - n) / 100;
    list.push({ label: `T${n}`, value: n * 3, cost: trebleCost });
  }
  for (let n = 20; n >= 1; n--) list.push({ label: `S${n}`, value: n, cost: 10 + (20 - n) / 100 });
  list.push({ label: "25", value: 25, cost: 20 });
  list.push({ label: "Bull", value: 50, cost: 21 });
  for (let n = 20; n >= 1; n--) list.push({ label: `D${n}`, value: n * 2, cost: 22 + (20 - n) / 100 });
  return list;
})();

type Route = { darts: CostedSegment[]; finish: CostedSegment };

function setupCosts(route: Route): number[] {
  return route.darts.map((d) => d.cost);
}

/** Negative if `a` is the better route. */
function compareRoutes(a: Route, b: Route): number {
  const len = a.darts.length - b.darts.length;
  if (len !== 0) return len;
  const fin = a.finish.cost - b.finish.cost;
  if (fin !== 0) return fin;
  const ca = setupCosts(a);
  const cb = setupCosts(b);
  const sum = ca.reduce((s, c) => s + c, 0) - cb.reduce((s, c) => s + c, 0);
  if (sum !== 0) return sum;
  for (let i = 0; i < ca.length; i++) {
    const d = (ca[i] ?? 0) - (cb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function findRoute(remaining: number): Route | null {
  let best: Route | null = null;
  const consider = (route: Route) => {
    if (!best || compareRoutes(route, best) < 0) best = route;
  };

  for (const finish of FINISHING) {
    const rest = remaining - finish.value;
    if (rest === 0) consider({ darts: [], finish });
  }
  if (best) return best;

  for (const finish of FINISHING) {
    const rest = remaining - finish.value;
    for (const a of SETUP) if (a.value === rest) consider({ darts: [a], finish });
  }
  if (best) return best;

  for (const finish of FINISHING) {
    const rest = remaining - finish.value;
    if (rest <= 0) continue;
    for (const a of SETUP) {
      for (const b of SETUP) {
        if (a.value + b.value !== rest || a.cost > b.cost) continue; // cheaper setup dart first
        consider({ darts: [a, b], finish });
      }
    }
  }
  return best;
}

const cache = new Map<number, string[] | null>();

/**
 * Suggested checkout route for `remaining` (2–170), e.g. 170 → ["T20", "T20", "Bull"].
 * Returns null when the score can't be finished in three darts.
 */
export function suggestCheckout(remaining: number): string[] | null {
  if (cache.has(remaining)) return cache.get(remaining) ?? null;
  let result: string[] | null = null;
  if (isFinishable(remaining)) {
    const route = findRoute(remaining);
    if (route) result = [...route.darts.map((d) => d.label), route.finish.label];
  }
  cache.set(remaining, result);
  return result;
}

/** Fewest darts that can finish `remaining`, or null if it can't be finished. */
export function minCheckoutDarts(remaining: number): 1 | 2 | 3 | null {
  const route = suggestCheckout(remaining);
  return route ? (route.length as 1 | 2 | 3) : null;
}
