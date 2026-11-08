"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { mergeVisits, type PendingOp, type Visit } from "@/lib/domain/match";
import { createClient } from "@/lib/supabase/client";
import { toVisit, VISIT_COLUMNS } from "@/lib/supabase/visits";

type WriteResult = { error: unknown };

/**
 * Optimistic visit list for one match. Writes run one at a time in entry order; the screen
 * shows the server's visits plus this device's unsent operations. Other devices' changes
 * arrive through Realtime (a visit insert, or the match row touched by undo/checkout).
 * If a write fails, everything queued after it is dropped and the list reloads.
 */
export function useMatchSync(matchId: string, initial: Visit[]) {
  const db = useMemo(() => createClient(), []);
  const [server, setServer] = useState<Visit[]>(initial);
  const [ops, setOps] = useState<PendingOp[]>([]);
  const [error, setError] = useState<string | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const epoch = useRef(0);

  const refetch = useCallback(async () => {
    const { data, error: fetchError } = await db
      .from("visits")
      .select(VISIT_COLUMNS)
      .eq("match_id", matchId)
      .order("leg_no")
      .order("seq");
    if (!fetchError) setServer(data.map(toVisit));
  }, [db, matchId]);

  useEffect(() => {
    const channel = db
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "visits", filter: `match_id=eq.${matchId}` },
        () => void refetch(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        () => void refetch(),
      )
      // Catch up on anything saved between the server render and (re)connecting.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refetch();
      });
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void db.removeChannel(channel);
    };
  }, [db, matchId, refetch]);

  const run = useCallback(
    (op: PendingOp, write: () => PromiseLike<WriteResult>) => {
      const mine = epoch.current;
      setOps((o) => [...o, op]);
      chain.current = chain.current.then(async () => {
        if (epoch.current !== mine) return;
        let failed = false;
        try {
          failed = (await write()).error != null;
        } catch {
          failed = true;
        }
        if (epoch.current !== mine) return;
        if (failed) {
          epoch.current += 1;
          setOps([]);
          setError(copy.scoring.saveFailed);
          await refetch();
          return;
        }
        setServer((s) => mergeVisits(s, [op]));
        setOps((o) => o.filter((x) => x !== op));
      });
    },
    [refetch],
  );

  const visits = useMemo(() => mergeVisits(server, ops), [server, ops]);

  return {
    db,
    visits,
    run,
    /** Resolves once every queued write has finished. */
    flush: () => chain.current,
    saving: ops.length > 0,
    error,
    clearError: () => setError(null),
  };
}
