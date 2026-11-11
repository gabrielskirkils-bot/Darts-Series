"use client";

import { useState, useTransition } from "react";
import { alertError, alertOk, btnDanger, btnPrimary, btnSecondary, card } from "@/components/ui";
import { copy } from "@/lib/copy";
import type { Seeding } from "@/lib/domain/groups";
import {
  deleteTournament,
  finishTournament,
  recalculateResults,
  redrawGroups,
  startKnockout,
  type TournamentActionState,
} from "@/app/tournaments/actions";

/** Organizer actions: start knockout, redraw groups, delete (with confirmation). */
export function TournamentActions({
  tournamentId,
  canRedraw,
  canStartKnockout,
  canFinish,
  finished,
  seeding,
}: {
  tournamentId: string;
  canRedraw: boolean;
  canStartKnockout: boolean;
  canFinish: boolean;
  finished: boolean;
  seeding: Seeding;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<"redraw" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function run(fn: () => Promise<TournamentActionState>, success: string | null = null) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) setError(result.message);
      else {
        setConfirming(null);
        setNotice(success);
      }
    });
  }

  return (
    <section className={`${card} space-y-3`}>
      {canFinish && (
        <div className="space-y-2">
          <button
            type="button"
            className={`${btnPrimary} min-h-14 text-lg`}
            disabled={pending}
            onClick={() => run(() => finishTournament(tournamentId))}
          >
            {pending ? copy.tournament.working : copy.tournament.finish}
          </button>
          <p className="text-sm text-muted">{copy.tournament.finishHint}</p>
        </div>
      )}

      {finished && (
        <div className="space-y-2">
          <button
            type="button"
            className={btnSecondary}
            disabled={pending}
            onClick={() => run(() => recalculateResults(tournamentId), copy.tournament.recalculated)}
          >
            {pending ? copy.tournament.working : copy.tournament.recalculate}
          </button>
          <p className="text-sm text-muted">{copy.tournament.recalculateHint}</p>
        </div>
      )}

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
        <p className="text-sm text-alert" role="alert">
          {finished ? copy.tournament.deleteFinishedWarning : copy.tournament.deleteWarning}
        </p>
      )}
      {notice && (
        <p className={alertOk} role="status">
          {notice}
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
