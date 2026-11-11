"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { input, label } from "@/components/ui";
import { copy, formatElo } from "@/lib/copy";
import { searchPlayers, sortPlayers, type PlayerSortKey } from "@/lib/domain/players";
import type { PlayerSummary } from "@/lib/supabase/queries";
import { AddPlayerForm } from "./player-form";

const SORT_KEYS: PlayerSortKey[] = ["name", "elo", "points", "tournaments"];

export function PlayersBrowser({ players, canEdit }: { players: PlayerSummary[]; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PlayerSortKey>("name");
  const [showArchived, setShowArchived] = useState(false);

  const pool = useMemo(() => players.filter((p) => showArchived || p.active), [players, showArchived]);
  const shown = useMemo(() => sortPlayers(searchPlayers(pool, query), sort), [pool, query, sort]);
  const archivedCount = players.length - players.filter((p) => p.active).length;

  return (
    <div className="space-y-4">
      {canEdit && <AddPlayerForm players={players} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="player-search" className={label}>
            {copy.players.searchLabel}
          </label>
          <input
            id="player-search"
            type="search"
            className={input}
            placeholder={copy.players.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <span className={label} id="sort-label">
            {copy.players.sortLabel}
          </span>
          <div role="group" aria-labelledby="sort-label" className="flex rounded-lg border border-line p-0.5">
            {SORT_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={sort === key}
                onClick={() => setSort(key)}
                className={`min-h-10 flex-1 rounded-md px-3 text-sm font-medium sm:flex-none ${
                  sort === key ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {copy.players.sort[key]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>{copy.players.count(shown.length, pool.length)}</span>
        {archivedCount > 0 && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="size-5 accent-gold"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            {copy.players.showArchived} ({archivedCount})
          </label>
        )}
      </div>

      {players.length === 0 ? (
        <p className="text-muted">{canEdit ? copy.players.emptyOrganizer : copy.players.empty}</p>
      ) : pool.length === 0 ? (
        <p className="text-muted">{copy.players.allArchived}</p>
      ) : shown.length === 0 ? (
        <p className="text-muted">{copy.players.noMatches}</p>
      ) : (
        <PlayerTable players={shown} />
      )}
    </div>
  );
}

function PlayerTable({ players }: { players: PlayerSummary[] }) {
  const th = "px-3 py-2 text-right font-medium";
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full text-left">
        <thead className="bg-surface text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="px-3 py-2 font-medium">{copy.players.columns.player}</th>
            <th className={th}>{copy.players.columns.elo}</th>
            <th className={th}>{copy.players.columns.points}</th>
            <th className={`${th} hidden sm:table-cell`}>{copy.players.columns.tournaments}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {players.map((p) => (
            <tr key={p.id} className="hover:bg-surface/60">
              <td className="px-3 py-1">
                <Link href={`/players/${p.id}`} className="flex min-h-11 flex-col justify-center">
                  <span className="font-semibold">
                    {p.name}
                    {!p.active && (
                      <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-muted">
                        {copy.players.archived}
                      </span>
                    )}
                  </span>
                  {p.nickname && <span className="text-sm text-muted">“{p.nickname}”</span>}
                </Link>
              </td>
              <td className="num px-3 text-right text-lg">{formatElo(p.elo)}</td>
              <td className="num px-3 text-right text-lg">{p.points}</td>
              <td className="num hidden px-3 text-right text-lg sm:table-cell">{p.tournaments}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
