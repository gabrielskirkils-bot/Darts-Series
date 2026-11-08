"use client";

import { useState, useTransition } from "react";
import { alertError, btnDanger, btnPrimary, btnSecondary, card } from "@/components/ui";
import { copy } from "@/lib/copy";
import type { Seeding } from "@/lib/domain/groups";
import { deleteTournament, redrawGroups, startKnockout, type TournamentActionState } from "@/app/tournaments/actions";

/** Organizer actions: start knockout, redraw groups, delete (with confirmation). */
export function TournamentActions({
  tournamentId,
  canRedraw,
  canStartKnockout,
  seeding,
}: {
  tournamentId: string;
  canRedraw: boolean;
  canStartKnockout: boolean;
  seeding: Seeding;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<"redraw" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<TournamentActionState>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) setError(result.message);
      else setConfirming(null);
    });
  }

  return (
    <section className={`${card} space-y-3`}>
      {canStartKnockout && (
        <div className="space-y-2">
          <button
            type="button"
            className={`${btnPrimary} min-h-14 text-lg`}
            disabled={pending}
            onClick={() => run(() => startKnockout(tournamentId))}
          >
            {pending ? copy.tournament.working : copy.tournament.startKnockout}
          </button>
          <p className="text-sm text-muted">{copy.tournament.startKnockoutHint}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canRedraw &&
          (confirming === "redraw" ? (
            <>
              <button
                type="button"
                className={seeding === "elo" ? btnPrimary : btnSecondary}
                disabled={pending}
                onClick={() => run(() => redrawGroups(tournamentId, "elo"))}
              >
                {copy.tournament.redrawElo}
              </button>
              <button
                type="button"
                className={seeding === "random" ? btnPrimary : btnSecondary}
                disabled={pending}
                onClick={() => run(() => redrawGroups(tournamentId, "random"))}
              >
                {copy.tournament.redrawRandom}
              </button>
              <button type="button" className={btnSecondary} onClick={() => setConfirming(null)}>
                {copy.common.cancel}
              </button>
            </>
          ) : (
            <button type="button" className={btnSecondary} onClick={() => setConfirming("redraw")}>
              {copy.tournament.redraw}
            </button>
          ))}

        {confirming === "delete" ? (
          <>
            <button
              type="button"
              className={btnDanger}
              disabled={pending}
              onClick={() => run(() => deleteTournament(tournamentId))}
            >
              {copy.tournament.confirmDelete}
            </button>
            <button type="button" className={btnSecondary} onClick={() => setConfirming(null)}>
              {copy.common.cancel}
            </button>
          </>
        ) : (
          <button type="button" className={btnSecondary} onClick={() => setConfirming("delete")}>
            {copy.tournament.delete}
          </button>
        )}
      </div>

      {confirming === "redraw" && <p className="text-sm text-muted">{copy.tournament.redrawHint}</p>}
      {confirming === "delete" && (
        <p className="text-sm text-board-red" role="alert">
          {copy.tournament.deleteWarning}
        </p>
      )}
      {error && (
        <p className={alertError} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
