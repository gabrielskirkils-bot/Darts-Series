import "server-only";
import { createClient } from "./server";

export type Overview = { players: number; tournaments: number };

/** Public counts for the home page (anonymous read via RLS). */
export async function getOverview(): Promise<Overview> {
  const supabase = await createClient();
  const [players, tournaments] = await Promise.all([
    supabase.from("players").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("tournaments").select("id", { count: "exact", head: true }),
  ]);
  if (players.error) throw players.error;
  if (tournaments.error) throw tournaments.error;
  return { players: players.count ?? 0, tournaments: tournaments.count ?? 0 };
}
