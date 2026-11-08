// Player stats from visits (SPEC section 4.12). Mirrors the player_tournament_stats view.

export type StatVisit = {
  matchId: string;
  legNo: number;
  seq: number;
  score: number;
  darts: number;
  dartsAtDouble: number;
  bust: boolean;
  isCheckout: boolean;
};

export type StatTotals = {
  points: number;
  darts: number;
  first9Points: number;
  first9Darts: number;
  t180: number;
  t140: number;
  t100: number;
  highestCheckout: number;
  checkouts: number;
  dartsAtDouble: number;
  /** Fewest darts in a won leg, null if no leg won. */
  bestLegDarts: number | null;
};

export const EMPTY_TOTALS: StatTotals = {
  points: 0,
  darts: 0,
  first9Points: 0,
  first9Darts: 0,
  t180: 0,
  t140: 0,
  t100: 0,
  highestCheckout: 0,
  checkouts: 0,
  dartsAtDouble: 0,
  bestLegDarts: null,
};

/** Totals for one player's visits (pass only that player's visits). */
export function visitTotals(visits: readonly StatVisit[]): StatTotals {
  const t = { ...EMPTY_TOTALS };
  const legs = new Map<string, StatVisit[]>();
  for (const v of visits) {
    const key = `${v.matchId}:${v.legNo}`;
    const list = legs.get(key) ?? [];
    list.push(v);
    legs.set(key, list);
  }

  for (const legVisits of legs.values()) {
    legVisits.sort((a, b) => a.seq - b.seq);
    let legDarts = 0;
    let won = false;
    legVisits.forEach((v, i) => {
      const pts = v.bust ? 0 : v.score;
      t.points += pts;
      t.darts += v.darts;
      legDarts += v.darts;
      if (i < 3) {
        t.first9Points += pts;
        t.first9Darts += v.darts;
      }
      if (!v.bust) {
        if (v.score === 180) t.t180++;
        else if (v.score >= 140) t.t140++;
        else if (v.score >= 100) t.t100++;
      }
      t.dartsAtDouble += v.dartsAtDouble;
      if (v.isCheckout) {
        won = true;
        t.checkouts++;
        t.highestCheckout = Math.max(t.highestCheckout, v.score);
      }
    });
    if (won && (t.bestLegDarts === null || legDarts < t.bestLegDarts)) t.bestLegDarts = legDarts;
  }
  return t;
}

/** Combines totals (e.g. per-tournament view rows) into one. */
export function combineTotals(list: readonly StatTotals[]): StatTotals {
  return list.reduce<StatTotals>(
    (acc, t) => ({
      points: acc.points + t.points,
      darts: acc.darts + t.darts,
      first9Points: acc.first9Points + t.first9Points,
      first9Darts: acc.first9Darts + t.first9Darts,
      t180: acc.t180 + t.t180,
      t140: acc.t140 + t.t140,
      t100: acc.t100 + t.t100,
      highestCheckout: Math.max(acc.highestCheckout, t.highestCheckout),
      checkouts: acc.checkouts + t.checkouts,
      dartsAtDouble: acc.dartsAtDouble + t.dartsAtDouble,
      bestLegDarts:
        acc.bestLegDarts === null
          ? t.bestLegDarts
          : t.bestLegDarts === null
            ? acc.bestLegDarts
            : Math.min(acc.bestLegDarts, t.bestLegDarts),
    }),
    { ...EMPTY_TOTALS },
  );
}

/** 3-dart average, null without darts. */
export function threeDartAverage(points: number, darts: number): number | null {
  return darts > 0 ? (points / darts) * 3 : null;
}

export function first9Average(t: StatTotals): number | null {
  return threeDartAverage(t.first9Points, t.first9Darts);
}

/** Checkout % (0–100), null without darts at double. */
export function checkoutPercent(t: StatTotals): number | null {
  return t.dartsAtDouble > 0 ? (t.checkouts / t.dartsAtDouble) * 100 : null;
}

// ---------------------------------------------------------------
// Records (fallback entries count here)
// ---------------------------------------------------------------

export type RecordMatch = {
  p1: string;
  p2: string;
  legsP1: number;
  legsP2: number;
  winnerId: string | null;
  isBye?: boolean;
};

export type WinLoss = { won: number; lost: number };

export type PlayerRecord = { matches: WinLoss; legs: WinLoss };

/** Match and leg W–L for a player over finished matches. */
export function playerRecord(playerId: string, matches: readonly RecordMatch[]): PlayerRecord {
  const rec: PlayerRecord = { matches: { won: 0, lost: 0 }, legs: { won: 0, lost: 0 } };
  for (const m of matches) {
    if (m.isBye || !m.winnerId) continue;
    const side = m.p1 === playerId ? 0 : m.p2 === playerId ? 1 : null;
    if (side === null) continue;
    if (m.winnerId === playerId) rec.matches.won++;
    else rec.matches.lost++;
    rec.legs.won += side === 0 ? m.legsP1 : m.legsP2;
    rec.legs.lost += side === 0 ? m.legsP2 : m.legsP1;
  }
  return rec;
}

/** Head-to-head W–L against each opponent. */
export function headToHead(playerId: string, matches: readonly RecordMatch[]): Map<string, WinLoss> {
  const result = new Map<string, WinLoss>();
  for (const m of matches) {
    if (m.isBye || !m.winnerId) continue;
    const opponent = m.p1 === playerId ? m.p2 : m.p2 === playerId ? m.p1 : null;
    if (!opponent) continue;
    const wl = result.get(opponent) ?? { won: 0, lost: 0 };
    if (m.winnerId === playerId) wl.won++;
    else wl.lost++;
    result.set(opponent, wl);
  }
  return result;
}
