"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Hidden for at least this long before becoming visible again → refresh (may have missed events). */
const MISSED_AFTER_MS = 15_000;

/** Re-renders the page from the server when this tournament's matches or status change. */
export function LiveRefresh({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Several rows change per action (e.g. a result plus advancement); refresh once.
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournamentId}` },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` },
        schedule,
      )
      // Changes made between the server render and (re)connecting would otherwise be missed.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") schedule();
      });
    // A board tablet waking from sleep may have missed events while hidden. Brief flips
    // (some embedded browsers toggle visibility every few seconds) don't need a refresh.
    let hiddenSince: number | null = document.visibilityState === "hidden" ? Date.now() : null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenSince = Date.now();
        return;
      }
      if (hiddenSince !== null && Date.now() - hiddenSince >= MISSED_AFTER_MS) schedule();
      hiddenSince = null;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [tournamentId, router]);

  return null;
}
