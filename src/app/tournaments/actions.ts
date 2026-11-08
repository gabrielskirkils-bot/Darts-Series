"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { copy } from "@/lib/copy";
import type { Seeding } from "@/lib/domain/groups";
import {
  canRedrawGroups,
  canStartKnockout,
  finalResults,
  finishBlocker,
  groupTables,
  normalizeStructure,
  parseTournamentInput,
  planDraw,
  planKnockoutFromGroups,
  planManualResult,
  validateTournamentInput,
} from "@/lib/domain/tournament";
import { NotOrganizerError, requireOrganizer } from "@/lib/supabase/auth";
import { getSettings } from "@/lib/supabase/queries";
import { eloPayload } from "@/lib/supabase/ranking";
import { createClient } from "@/lib/supabase/server";
import {
  getElos,
  getTournament,
  koJson,
  matchesJson,
  playersJson,
  slotsJson,
} from "@/lib/supabase/tournaments";

export type TournamentActionState = { ok: boolean; message: string | null };

const UUID_RE = /^[0-9a-f-]{36}$/i;
type ErrorKey = keyof typeof copy.tournament.errors;

function fail(key: ErrorKey): TournamentActionState {
  return { ok: false, message: copy.tournament.errors[key] };
}

function failure(error: unknown): TournamentActionState {
  if (error instanceof NotOrganizerError) return { ok: false, message: copy.common.notAllowed };
  return { ok: false, message: copy.common.genericError };
}

/** The Postgres functions raise short codes (e.g. "groups_started"); map them to copy. */
function rpcFailure(error: PostgrestError): TournamentActionState {
  const key = error.message as ErrorKey;
  if (key in copy.tournament.errors) return fail(key);
  return { ok: false, message: copy.common.genericError };
}

/** Wizard submit: draws on the server (current Elo, server randomness) and creates atomically. */
export async function createTournament(raw: unknown): Promise<TournamentActionState> {
  let id: string;
  try {
    await requireOrganizer();
    const input = parseTournamentInput(raw);
    if (!input) return { ok: false, message: copy.wizard.invalidInput };
    const errors = validateTournamentInput(input);
    if (errors.length) return { ok: false, message: copy.wizard.inputErrors[errors[0]!] };

    const elos = await getElos(input.playerIds);
    if (input.playerIds.some((pid) => !elos.get(pid)?.active)) {
      return { ok: false, message: copy.wizard.playersChanged };
    }
    const structure = normalizeStructure(input.structure);
    const plan = planDraw(
      input.playerIds.map((pid) => ({ playerId: pid, elo: elos.get(pid)!.elo })),
      {
        format: structure.format,
        groupCount: structure.groupCount,
        thirdPlace: structure.thirdPlace,
        seeding: input.seeding,
        formats: input.formats,
      },
      Math.random,
    );

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_tournament", {
      p: {
        name: input.name.trim(),
        date: input.date,
        status: plan.status,
        format: structure.format,
        group_count: structure.groupCount,
        advance: structure.advance,
        third_place: structure.thirdPlace,
        seeding: input.seeding,
        boards: input.boards,
        fmt: input.formats,
        ko: koJson(plan.ko),
        players: playersJson(plan.players),
        matches: matchesJson(plan.matches),
      },
    });
    if (error) return rpcFailure(error);
    id = data;
  } catch (error) {
    return failure(error);
  }
  redirect(`/t/${id}`);
}

/** New group draw while no group match has started (SPEC 4.3). */
export async function redrawGroups(tournamentId: string, seeding: Seeding): Promise<TournamentActionState> {
  try {
    await requireOrganizer();
    if (!UUID_RE.test(tournamentId) || (seeding !== "elo" && seeding !== "random")) return fail("not_found");
    const t = await getTournament(tournamentId);
    if (!t) return fail("not_found");
    if (!canRedrawGroups(t.status, t.matches)) return fail("groups_started");

    const ids = t.entrants.map((e) => e.playerId);
    const elos = await getElos(ids);
    const plan = planDraw(
      ids.map((pid) => ({ playerId: pid, elo: elos.get(pid)?.elo ?? 1500 })),
      { format: t.format, groupCount: t.groupCount, thirdPlace: t.thirdPlace, seeding, formats: t.fmt },
      Math.random,
    );

    const supabase = await createClient();
    const { error } = await supabase.rpc("redraw_groups", {
      p_tournament: t.id,
      p: { players: playersJson(plan.players), matches: matchesJson(plan.matches) },
    });
    if (error) return rpcFailure(error);
    if (seeding !== t.seeding) {
      // Informational only (which method made the current draw); the draw itself is already saved.
      await supabase.from("tournaments").update({ seeding }).eq("id", t.id);
    }
    refresh();
    return { ok: true, message: null };
  } catch (error) {
    return failure(error);
  }
}

/** Draws the bracket from the final group tables (SPEC 4.5). */
export async function startKnockout(tournamentId: string): Promise<TournamentActionState> {
  try {
    await requireOrganizer();
    if (!UUID_RE.test(tournamentId)) return fail("not_found");
    const t = await getTournament(tournamentId);
    if (!t) return fail("not_found");
    if (!canStartKnockout(t.format, t.status, t.matches)) return fail("groups_unfinished");

    const tables = groupTables(t.entrants, t.matches, t.groupCount, new Map(Object.entries(t.averages)));
    const plan = planKnockoutFromGroups(tables, t.advance, t.thirdPlace, t.fmt);

    const supabase = await createClient();
    const { error } = await supabase.rpc("start_knockout", {
      p_tournament: t.id,
      p: { matches: matchesJson(plan.matches), ko: koJson(plan.ko) },
    });
    if (error) return rpcFailure(error);
    refresh();
    return { ok: true, message: null };
  } catch (error) {
    return failure(error);
  }
}

/** Fallback leg score from the tournament page (SPEC 4.7), with knockout advancement. */
export async function setMatchResult(
  tournamentId: string,
  matchId: string,
  legsP1: number,
  legsP2: number,
): Promise<TournamentActionState> {
  try {
    await requireOrganizer();
    if (!UUID_RE.test(tournamentId) || !UUID_RE.test(matchId)) return fail("notEditable");
    const t = await getTournament(tournamentId);
    if (!t) return fail("not_found");
    const plan = planManualResult(t.matches, matchId, t.status, legsP1, legsP2, t.ko?.rounds ?? null);
    if (!plan.ok) return fail(plan.error);

    const supabase = await createClient();
    const { error } = await supabase.rpc("apply_match_result", {
      p_match: matchId,
      p_legs_p1: legsP1,
      p_legs_p2: legsP2,
      p_winner: plan.winnerId,
      p_slots: slotsJson(plan.slots),
    });
    if (error) return rpcFailure(error);
    refresh();
    return { ok: true, message: null };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Freezes places and points and recalculates Elo (SPEC 4.9). `finish` = false re-freezes a
 * finished tournament ("Recalculate results"), e.g. after the points table or Elo settings change.
 */
async function saveResults(tournamentId: string, finish: boolean): Promise<TournamentActionState> {
  try {
    await requireOrganizer();
    if (!UUID_RE.test(tournamentId)) return fail("not_found");
    const [t, settings] = await Promise.all([getTournament(tournamentId), getSettings()]);
    if (!t) return fail("not_found");
    if (finish) {
      const blocker = finishBlocker(t.format, t.status, t.matches);
      if (blocker) return fail(blocker);
    } else if (t.status !== "done") {
      return fail("not_finished");
    }

    const results = finalResults(t, settings.points);
    if (results.length !== t.entrants.length) return fail("results_incomplete");

    const supabase = await createClient();
    const elo = await eloPayload(supabase, { k: settings.eloK, start: settings.eloStart }, { include: t.id });
    const { error } = await supabase.rpc("save_results", {
      p_tournament: t.id,
      p_finish: finish,
      p_results: results.map((r) => ({ player_id: r.playerId, place: r.place, points: r.points })),
      p_elo: elo,
    });
    if (error) return rpcFailure(error);
    refresh();
    return { ok: true, message: null };
  } catch (error) {
    return failure(error);
  }
}

export async function finishTournament(tournamentId: string): Promise<TournamentActionState> {
  return saveResults(tournamentId, true);
}

export async function recalculateResults(tournamentId: string): Promise<TournamentActionState> {
  return saveResults(tournamentId, false);
}

/** Deletes a tournament (matches, visits, results cascade); Elo is recomputed without it. */
export async function deleteTournament(tournamentId: string): Promise<TournamentActionState> {
  try {
    await requireOrganizer();
    if (!UUID_RE.test(tournamentId)) return fail("not_found");
    const settings = await getSettings();
    const supabase = await createClient();
    const elo = await eloPayload(supabase, { k: settings.eloK, start: settings.eloStart }, { exclude: tournamentId });
    const { error } = await supabase.rpc("delete_tournament", { p_tournament: tournamentId, p_elo: elo });
    if (error) return rpcFailure(error);
  } catch (error) {
    return failure(error);
  }
  redirect("/tournaments");
}
