"use server";

import { refresh } from "next/cache";
import { copy } from "@/lib/copy";
import { parseSettings, sortPointsRows, validateSettings, type AppSettings } from "@/lib/domain/settings";
import { NotOrganizerError, requireOrganizer } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type SaveState = { ok: boolean; message: string | null };

export async function saveSettings(input: AppSettings): Promise<SaveState> {
  try {
    await requireOrganizer();
    // Re-parse so only known fields are stored, then validate.
    const settings = parseSettings(input);
    settings.points = sortPointsRows(settings.points);
    const errors = validateSettings(settings);
    if (errors.length) return { ok: false, message: copy.settings.errors[errors[0]!] };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("settings")
      .update({ data: settings, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select("id");
    if (error || !data?.length) return { ok: false, message: copy.common.genericError };
    refresh();
    return { ok: true, message: copy.settings.saved };
  } catch (error) {
    if (error instanceof NotOrganizerError) return { ok: false, message: copy.common.notAllowed };
    return { ok: false, message: copy.common.genericError };
  }
}
