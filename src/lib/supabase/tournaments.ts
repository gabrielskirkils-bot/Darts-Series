import "server-only";
import type { SlotUpdate } from "@/lib/domain/bracket";
import type { Seeding } from "@/lib/domain/groups";
import { parseSettings } from "@/lib/domain/settings";
import { tournamentEloChange, type EloRow } from "@/lib/domain/ranking";
import { threeDartAverage, type StatTotals } from "@/lib/domain/stats";
import type { Format, MatchFormats } from "@/lib/domain/structure";
import {
  parseKoMeta,
  type EntrantPlan,
  type EntrantRow,
  type KoMeta,
  type MatchPlan,
  type MatchRow,
  type MatchStage,
  type MatchStatus,
  type TournamentStatus,
} from "@/lib/domain/tournament";
import { toTotals } from "./ranking";
import { createClient } from "./server";
import type { Json, Tables } from "./types";

export type TournamentListItem = {
  id: string;
  name: string;
  date: string;
  status: TournamentStatus;
  format: Format;
  players: number;
};

/** Every tournament, newest first, with its entrant count (public). */
export async function listTournaments(): Promise<TournamentListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, date, status, format, tournament_players(count)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((t) => ({
    id: t.id,
    name: t.name,
    date: t.date,
    status: t.status as TournamentStatus,
    format: t.format as Format,
    players: t.tournament_players[0]?.count ?? 0,
  }));
}

export async function countTournaments(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("tournaments").select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/** Just the name, for page titles. */
export async function getTournamentName(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("tournaments").select("name").eq("id", id).maybeSingle();
  return data?.name ?? null;
}

export type Entrant = EntrantRow & { name: string; nickname: string | null };

export type TournamentDetail = {
  id: string;
  name: string;
  date: string;
  status: TournamentStatus;
  format: Format;
  groupCount: number;
  advance: number;
  thirdPlace: boolean;
  seeding: Seeding;
  boards: number;
  fmt: MatchFormats;
  ko: KoMeta | null;
  entrants: Entrant[];
  matches: MatchRow[];
  /** 3-dart average per player in this tournament (null without visit stats). */
  averages: Record<string, number | null>;
  /** Visit stats per player (finished matches only). */
  stats: Record<string, StatTotals>;
  /** Frozen places and points (finished tournaments), best place first. */
  results: { playerId: string; place: number; points: number }[];
  /** Elo change per player over this tournament (finished tournaments). */
  eloChanges: Record<string, number>;
};

export function toMatchRow(m: Tables<"matches">): MatchRow {
  return {
    id: m.id,
    stage: m.stage as MatchStage,
    groupIndex: m.group_index,
    round: m.round,
    slot: m.slot,
    sortOrder: m.sort_order,
    p1: m.p1,
    p2: m.p2,
    legsP1: m.legs_p1,
    legsP2: m.legs_p2,
    winnerId: m.winner_id,
    status: m.status as MatchStatus,
    isBye: m.is_bye,
    isManual: m.is_manual,
    bestOf: m.best_of,
    startScore: m.start_score,
    board: m.board,
    finishedAt: m.finished_at,
  };
}

/** A tournament with entrants, matches and per-player averages; null if it doesn't exist. */
export async function getTournament(id: string): Promise<TournamentDetail | null> {
  const supabase = await createClient();
  const { data: t, error } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!t) return null;

  const [entrants, matches, stats, results, elo] = await Promise.all([
    supabase
      .from("tournament_players")
      .select("player_id, seed, group_index, players(name, nickname)")
      .eq("tournament_id", id)
      .order("seed"),
    supabase.from("matches").select("*").eq("tournament_id", id).order("sort_order"),
    supabase.from("player_tournament_stats").select("*").eq("tournament_id", id),
    supabase.from("tournament_results").select("player_id, place, points").eq("tournament_id", id).order("place"),
    supabase
      .from("elo_history")
      .select("player_id, rating_before, rating_after, played_at, match_id")
      .eq("tournament_id", id)
      .order("played_at")
      .order("match_id"),
  ]);
  for (const r of [entrants, matches, stats, results, elo]) if (r.error) throw r.error;

  const averages: Record<string, number | null> = {};
  const statsByPlayer: Record<string, StatTotals> = {};
  for (const s of stats.data!) {
    if (!s.player_id) continue;
    statsByPlayer[s.player_id] = toTotals(s);
    averages[s.player_id] = threeDartAverage(Number(s.points ?? 0), Number(s.darts ?? 0));
  }

  const eloRows: EloRow[] = elo.data!.map((h) => ({
    tournamentId: id,
    playerId: h.player_id,
    ratingBefore: Number(h.rating_before),
    ratingAfter: Number(h.rating_after),
    playedAt: h.played_at,
  }));
  const eloChanges: Record<string, number> = {};
  for (const pid of new Set(eloRows.map((h) => h.playerId))) {
    eloChanges[pid] = tournamentEloChange(eloRows, pid, id) ?? 0;
  }

  return {
    id: t.id,
    name: t.name,
    date: t.date,
    status: t.status as TournamentStatus,
    format: t.format as Format,
    groupCount: t.group_count,
    advance: t.advance,
    thirdPlace: t.third_place,
    seeding: t.seeding as Seeding,
    boards: t.boards,
    fmt: parseSettings({ fmt: t.fmt }).fmt,
    ko: parseKoMeta(t.ko),
    entrants: entrants.data!.map((e) => ({
      playerId: e.player_id,
      seed: e.seed,
      groupIndex: e.group_index,
      name: e.players?.name ?? "",
      nickname: e.players?.nickname ?? null,
    })),
    matches: matches.data!.map(toMatchRow),
    averages,
    stats: statsByPlayer,
    results: results.data!.map((r) => ({ playerId: r.player_id, place: r.place, points: r.points })),
    eloChanges,
  };
}

/** Current Elo for the given players (from player_summary), keyed by id. */
export async function getElos(ids: readonly string[]): Promise<Map<string, { elo: number; active: boolean }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("player_summary").select("id, elo, active").in("id", [...ids]);
  if (error) throw error;
  const map = new Map<string, { elo: number; active: boolean }>();
  for (const r of data) if (r.id) map.set(r.id, { elo: Number(r.elo ?? 1500), active: r.active ?? false });
  return map;
}

// ---------------------------------------------------------------
// RPC payloads (snake_case JSON for the Postgres functions in 0003)
// ---------------------------------------------------------------

export function matchesJson(matches: readonly MatchPlan[]): Json {
  return matches.map((m) => ({
    stage: m.stage,
    group_index: m.groupIndex,
    round: m.round,
    slot: m.slot,
    sort_order: m.sortOrder,
    p1: m.p1,
    p2: m.p2,
    start_score: m.startScore,
    best_of: m.bestOf,
    status: m.status,
    winner_id: m.winnerId,
    is_bye: m.isBye,
  }));
}

export function playersJson(players: readonly EntrantPlan[]): Json {
  return players.map((p) => ({ player_id: p.playerId, seed: p.seed, group_index: p.groupIndex }));
}

export function koJson(ko: KoMeta | null): Json {
  return ko ? { rounds: ko.rounds, size: ko.size, qualified: ko.qualified, third: ko.third } : null;
}

export function slotsJson(slots: readonly SlotUpdate[]): Json {
  return slots.map((s) => ({ stage: s.stage, round: s.round, slot: s.slot, side: s.side, player_id: s.playerId }));
}
