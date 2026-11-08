import type { Metadata } from "next";
import { Suspense } from "react";
import { alertError } from "@/components/ui";
import { copy } from "@/lib/copy";
import { getViewer } from "@/lib/supabase/auth";
import { listPlayers } from "@/lib/supabase/queries";
import { PlayersBrowser } from "./players-browser";

export const metadata: Metadata = { title: copy.players.title };

export default function PlayersPage() {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl font-bold tracking-wide uppercase">{copy.players.title}</h1>
      <Suspense fallback={<p className="text-muted">{copy.common.loading}</p>}>
        <Players />
      </Suspense>
    </div>
  );
}

async function Players() {
  const data = await Promise.all([listPlayers(), getViewer()]).catch(() => null);
  if (!data) return <p className={alertError}>{copy.common.loadError}</p>;
  const [players, viewer] = data;
  return <PlayersBrowser players={players} canEdit={viewer?.isOrganizer ?? false} />;
}
