import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "./env";
import type { Database } from "./types";

export type Db = SupabaseClient<Database>;

let browserClient: Db | undefined;

/** Supabase client for Client Components (scoreboard, TV, live tournament page). */
export function createClient(): Db {
  browserClient ??= createBrowserClient<Database>(supabaseUrl, supabaseKey);
  return browserClient;
}
