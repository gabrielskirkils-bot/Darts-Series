"use server";

import { refresh } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { copy } from "@/lib/copy";
import { matchState } from "@/lib/domain/match";
import { planConfirm } from "@/lib/domain/tournament";
import { NotOrganizerError, requireOrganizer } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getTournament, slotsJson } from "@/lib/supabase/tournaments";
import { fetchMatchVisits } from "@/lib/supabase/visits";

export type BoardActionState = { ok: boolean; message: string | null };

const UUID_RE = /^[0-9a-f-]{36}$/i;
type ErrorKey = keyof typeof copy.board.errors;

function fail(key: ErrorKey): BoardActionState {
  return { ok: false, message: copy.board.errors[key] };
}

function failure(error: unknown): BoardActionState {
  if (error instanceof NotOrganizerError) return { ok: false, message: copy.common.notAllowed };
  return { ok: false, message: copy.common.genericError };
}

function rpcFailure(error: PostgrestError): BoardActionState {
  const key = error.message as ErrorKey;
  return key in copy.board.errors ? fail(key) : { ok: false, message: copy.common.genericError };
}

/** Puts a waiting match live on this board with the bull-up winner throwing first. */
export async function startMatch(matchId: string, board: number, first: 0 | 1): Promise<BoardActionState> {
  try {
    await requireOrganizer();
    if (!UUID_RE.test(matchId)) return fail("not_found");
    const supabase = await createClient();
    const { error } = await supabase.rpc("start_match", { p_match: matchId, p_board: board, p_first: first });
    if (error) return rpcFailure(error);
    refresh();
    return { ok: true, message: null };
  } catch (error) {
    return failure(error);
  }
}

/** "Confirm result": winner from the visits, knockout advancement, board freed. */
export async function confirmMatch(tournamentId: string, matchId: string): Promise<BoardActionState> {
  try {
    await requireOrganizer();
    if (!UUID_RE.test(tournamentId) || !UUID_RE.test(matchId)) return fail("not_found");
    const t = await getTournament(tournamentId);
    const match = t?.matches.find((m) => m.id === matchId);
    if (!t || !match) return fail("not_found");
    if (match.status !== "live") return fail("match_not_live");

    const supabase = await createClient();
    const { firstStarter, visits } = await fetchMatchVisits(supabase, matchId);
    const state = matchState({ startScore: match.startScore, bestOf: match.bestOf, firstStarter }, visits);
    if (state.winner === null) return fail("match_unfinished");
    const plan = planConfirm(t.matches, matchId, state.winner, t.ko?.rounds ?? null);
    if (!plan) return fail("match_not_live");

    const { error } = await supabase.rpc("confirm_match", { p_match: matchId, p_slots: slotsJson(plan.slots) });
    if (error) return rpcFailure(error);
    refresh();
    return { ok: true, message: null };
  } catch (error) {
    return failure(error);
  }
}

/** Back to waiting; deletes every visit of the match. */
export async function abandonMatch(matchId: string): Promise<BoardActionState> {
  try {
    await requireOrganizer();
    if (!UUID_RE.test(matchId)) return fail("not_found");
    const supabase = await createClient();
    const { error } = await supabase.rpc("abandon_match", { p_match: matchId });
    if (error) return rpcFailure(error);
    refresh();
    return { ok: true, message: null };
  } catch (error) {
    return failure(error);
  }
}
