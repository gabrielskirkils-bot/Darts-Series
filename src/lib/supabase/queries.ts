import "server-only";
import { parseSettings, type AppSettings } from "@/lib/domain/settings";
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

export type PlayerSummary = {
  id: string;
  name: string;
  nickname: string | null;
  active: boolean;
  elo: number;
  points: number;
  tournaments: number;
  hasEntries: boolean;
};

type SummaryRow = {
  id: string | null;
  name: string | null;
  nickname: string | null;
  active: boolean | null;
  elo: number | null;
  points: number | null;
  tournaments: number | null;
  has_entries: boolean | null;
};

function toSummary(r: SummaryRow): PlayerSummary {
  return {
    id: r.id ?? "",
    name: r.name ?? "",
    nickname: r.nickname,
    active: r.active ?? true,
    elo: Number(r.elo ?? 1500),
    points: r.points ?? 0,
    tournaments: r.tournaments ?? 0,
    hasEntries: r.has_entries ?? false,
  };
}

/** Every player (active and archived) with Elo, points and tournaments played. */
export async function listPlayers(): Promise<PlayerSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("player_summary").select("*").order("name");
  if (error) throw error;
  return data.map(toSummary);
}

export async function getPlayer(id: string): Promise<PlayerSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("player_summary").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toSummary(data) : null;
}

export async function getSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("data").eq("id", 1).maybeSingle();
  if (error) throw error;
  return parseSettings(data?.data);
}
