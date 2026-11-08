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
    expect(data?.data).toMatchObject({ eloK: 32 });
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
});
