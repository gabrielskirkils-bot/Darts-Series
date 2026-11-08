// Visit rows ↔ domain visits. Shared by the server (board page) and the scoreboard client.

import type { Side, Visit } from "@/lib/domain/match";
import type { Db } from "./client";

export const VISIT_COLUMNS = "leg_no, seq, player, score, darts, darts_at_double, bust, is_checkout";

type VisitRow = {
  leg_no: number;
  seq: number;
  player: number;
  score: number;
  darts: number;
  darts_at_double: number;
  bust: boolean;
  is_checkout: boolean;
};

export function toVisit(r: VisitRow): Visit {
  return {
    legNo: r.leg_no,
    seq: r.seq,
    player: r.player as Side,
    score: r.score,
    darts: r.darts,
    dartsAtDouble: r.darts_at_double,
    bust: r.bust,
    isCheckout: r.is_checkout,
  };
}

export type MatchVisits = { firstStarter: Side; visits: Visit[] };

/** Leg-1 starter (bull-up winner) and every visit of a match. */
export async function fetchMatchVisits(db: Db, matchId: string): Promise<MatchVisits> {
  const [legs, visits] = await Promise.all([
    db.from("legs").select("starter").eq("match_id", matchId).eq("leg_no", 1).maybeSingle(),
    db.from("visits").select(VISIT_COLUMNS).eq("match_id", matchId).order("leg_no").order("seq"),
  ]);
  if (legs.error) throw legs.error;
  if (visits.error) throw visits.error;
  return { firstStarter: (legs.data?.starter ?? 0) as Side, visits: visits.data.map(toVisit) };
}
