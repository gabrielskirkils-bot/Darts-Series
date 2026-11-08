import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const PROBE = "__rls_probe__";

// SPEC 8.8: anonymous users can read, but RLS blocks every write, even via the API directly.
// Probes are harmless even if RLS were broken (a probe row, a timestamp bump).
test.describe("RLS for anonymous users", () => {
  const anon = () =>
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });

  test("can read public tables", async () => {
    const { data, error } = await anon().from("settings").select("data").single();
    expect(error).toBeNull();
    expect(data?.data).toMatchObject({ eloK: expect.any(Number), eloStart: expect.any(Number) });
  });

  test("cannot insert", async () => {
    const { error } = await anon().from("players").insert({ name: PROBE });
    expect(error).not.toBeNull();
  });

  test("cannot update or delete", async () => {
    const db = anon();
    const update = await db
      .from("settings")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select();
    expect(update.data ?? []).toHaveLength(0);

    const del = await db.from("players").delete().eq("name", PROBE).select();
    expect(del.data ?? []).toHaveLength(0);
  });

  test("cannot call the tournament write functions", async () => {
    const db = anon();
    const nil = "00000000-0000-0000-0000-000000000000";
    const create = await db.rpc("create_tournament", {
      p: { name: PROBE, date: "2026-01-01", status: "groups", format: "rr", fmt: {}, players: [], matches: [] },
    });
    expect(create.error).not.toBeNull();
    const redraw = await db.rpc("redraw_groups", { p_tournament: nil, p: {} });
    expect(redraw.error).not.toBeNull();
    const ko = await db.rpc("start_knockout", { p_tournament: nil, p: {} });
    expect(ko.error).not.toBeNull();
    const result = await db.rpc("apply_match_result", {
      p_match: nil,
      p_legs_p1: 1,
      p_legs_p2: 0,
      p_winner: nil,
      p_slots: [],
    });
    expect(result.error).not.toBeNull();
  });

  test("cannot call the scoreboard write functions", async () => {
    const db = anon();
    const nil = "00000000-0000-0000-0000-000000000000";
    const calls = await Promise.all([
      db.rpc("start_match", { p_match: nil, p_board: 1, p_first: 0 }),
      db.rpc("record_visit", {
        p_match: nil,
        p_leg_no: 1,
        p_seq: 1,
        p_player: 0,
        p_score: 60,
        p_darts: 3,
        p_darts_at_double: 0,
        p_bust: false,
        p_is_checkout: false,
        p_starter: 0,
      }),
      db.rpc("undo_visit", { p_match: nil, p_leg_no: 1, p_seq: 1 }),
      db.rpc("confirm_match", { p_match: nil, p_slots: [] }),
      db.rpc("abandon_match", { p_match: nil }),
    ]);
    for (const call of calls) expect(call.error).not.toBeNull();
  });

  test("cannot finish, recalculate or delete tournaments", async () => {
    const db = anon();
    const nil = "00000000-0000-0000-0000-000000000000";
    const calls = await Promise.all([
      db.rpc("save_results", { p_tournament: nil, p_finish: true, p_results: [], p_elo: [] }),
      db.rpc("save_results", { p_tournament: nil, p_finish: false, p_results: [], p_elo: [] }),
      db.rpc("delete_tournament", { p_tournament: nil, p_elo: [] }),
    ]);
    for (const call of calls) expect(call.error).not.toBeNull();
  });
});
