"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { validatePlayerInput } from "@/lib/domain/players";
import { copy } from "@/lib/copy";
import { NotOrganizerError, requireOrganizer } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { ok: boolean; message: string | null; id?: string };

const UNIQUE_VIOLATION = "23505";
const UUID_RE = /^[0-9a-f-]{36}$/i;

function failure(error: unknown): ActionState {
  if (error instanceof NotOrganizerError) return { ok: false, message: copy.common.notAllowed };
  return { ok: false, message: copy.common.genericError };
}

function readInput(formData: FormData) {
  return validatePlayerInput({
    name: String(formData.get("name") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
  });
}

export async function createPlayer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireOrganizer();
    const { value, errors } = readInput(formData);
    if (errors.length) return { ok: false, message: copy.players.inputErrors[errors[0]!] };

    const supabase = await createClient();
    const { data, error } = await supabase.from("players").insert(value).select("id").single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { ok: false, message: copy.players.duplicateError };
      return { ok: false, message: copy.common.genericError };
    }
    refresh();
    return { ok: true, message: copy.players.added(value.name), id: data.id };
  } catch (error) {
    return failure(error);
  }
}

export async function updatePlayer(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireOrganizer();
    if (!UUID_RE.test(id)) return { ok: false, message: copy.players.notFound };
    const { value, errors } = readInput(formData);
    if (errors.length) return { ok: false, message: copy.players.inputErrors[errors[0]!] };

    const supabase = await createClient();
    const { error } = await supabase.from("players").update(value).eq("id", id);
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { ok: false, message: copy.players.duplicateError };
      return { ok: false, message: copy.common.genericError };
    }
    refresh();
    return { ok: true, message: copy.common.saved };
  } catch (error) {
    return failure(error);
  }
}

export async function setPlayerActive(id: string, active: boolean): Promise<ActionState> {
  try {
    await requireOrganizer();
    const supabase = await createClient();
    const { error } = await supabase.from("players").update({ active }).eq("id", id);
    if (error) return { ok: false, message: copy.common.genericError };
    refresh();
    return { ok: true, message: null };
  } catch (error) {
    return failure(error);
  }
}

/** Deletes a player who never entered a tournament; anyone else must be archived. */
export async function deletePlayer(id: string): Promise<ActionState> {
  try {
    await requireOrganizer();
    const supabase = await createClient();
    const { count, error: countError } = await supabase
      .from("tournament_players")
      .select("player_id", { count: "exact", head: true })
      .eq("player_id", id);
    if (countError) return { ok: false, message: copy.common.genericError };
    if ((count ?? 0) > 0) return { ok: false, message: copy.players.cannotDelete };

    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) {
      // FK violation: referenced by matches/results after all.
      if (error.code === "23503") return { ok: false, message: copy.players.cannotDelete };
      return { ok: false, message: copy.common.genericError };
    }
  } catch (error) {
    return failure(error);
  }
  redirect("/players");
}
