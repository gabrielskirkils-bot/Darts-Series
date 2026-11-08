import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { alertError, card } from "@/components/ui";
import { copy, formatElo } from "@/lib/copy";
import { getViewer } from "@/lib/supabase/auth";
import { getPlayer, listPlayers } from "@/lib/supabase/queries";
import { EditPlayerForm } from "../player-form";
import { PlayerAdminActions } from "./player-admin";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default function PlayerPage({ params }: PageProps<"/players/[id]">) {
  return (
    <div className="space-y-5">
      <Link href="/players" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-cream">
        ← {copy.players.back}
      </Link>
      <Suspense fallback={<p className="text-muted">{copy.common.loading}</p>}>
        <PlayerContent params={params} />
      </Suspense>
    </div>
  );
}

async function PlayerContent({ params }: { params: PageProps<"/players/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const data = await Promise.all([getPlayer(id), getViewer()]).catch(() => null);
  if (!data) return <p className={alertError}>{copy.common.loadError}</p>;
  const [player, viewer] = data;
  if (!player) notFound();
  const canEdit = viewer?.isOrganizer ?? false;
  const allPlayers = canEdit ? await listPlayers().catch(() => []) : [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide uppercase">
          {player.name}
          {!player.active && (
            <span className="ml-3 align-middle rounded bg-surface-2 px-2 py-1 text-sm font-medium text-muted normal-case">
              {copy.players.archived}
            </span>
          )}
        </h1>
        {player.nickname && <p className="text-lg text-muted">“{player.nickname}”</p>}
      </header>

      <dl className="grid grid-cols-3 gap-3 sm:max-w-lg">
        <Tile label={copy.players.stats.elo} value={formatElo(player.elo)} />
        <Tile label={copy.players.stats.points} value={player.points} />
        <Tile label={copy.players.stats.tournaments} value={player.tournaments} />
      </dl>

      {player.tournaments === 0 && <p className="text-muted">{copy.players.profileEmpty}</p>}

      {canEdit && (
        <section className={`${card} space-y-4`}>
          <h2 className="font-display text-xl font-bold uppercase">{copy.players.editTitle}</h2>
          <EditPlayerForm player={player} players={allPlayers} />
          <PlayerAdminActions id={player.id} active={player.active} canDelete={!player.hasEntries} />
        </section>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3 sm:p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="num text-3xl font-bold sm:text-4xl">{value}</dd>
    </div>
  );
}
