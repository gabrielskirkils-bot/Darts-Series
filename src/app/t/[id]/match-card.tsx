"use client";

import { useState, useTransition } from "react";
import { alertError, btnGhost, btnPrimary, btnSecondary } from "@/components/ui";
import { copy } from "@/lib/copy";
import { manualResultWinner } from "@/lib/domain/match";
import { legsToWin } from "@/lib/domain/rules";
import { canEnterResult, type MatchRow, type TournamentStatus } from "@/lib/domain/tournament";
import { setMatchResult } from "@/app/tournaments/actions";

/** One match: players, leg score, state; organizers can enter a fallback leg score. */
export function MatchCard({
  match,
  label,
  names,
  status,
  tournamentId,
  canEdit,
  compact = false,
}: {
  match: MatchRow;
  label: string | null;
  names: Record<string, string>;
  status: TournamentStatus;
  tournamentId: string;
  canEdit: boolean;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const editable = canEdit && canEnterResult(match, status);
  const done = match.status === "done";
  const showLegs = !match.isBye && (done || match.status === "live");

  return (
    <div
      className={`rounded-lg border bg-surface ${match.status === "live" ? "border-board-red/70" : "border-line"} ${
        compact ? "p-2" : "p-3"
      }`}
    >
      {(label || match.status === "live" || match.isManual) && (
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 text-xs text-muted">
          {label && <span>{label}</span>}
          <span className="flex gap-2">
            {match.status === "live" && (
              <span className="font-semibold text-board-red uppercase">
                ● {copy.tournament.lists.live}
                {match.board !== null && ` · ${copy.tournament.onBoard(match.board)}`}
              </span>
            )}
            {done && match.isManual && <span>{copy.tournament.manual}</span>}
          </span>
        </div>
      )}
      <PlayerLine
        name={playerName(match.p1, match, names)}
        legs={match.legsP1}
        showLegs={showLegs}
        winner={done && !match.isBye && match.winnerId !== null && match.winnerId === match.p1}
      />
      <PlayerLine
        name={playerName(match.p2, match, names)}
        legs={match.legsP2}
        showLegs={showLegs}
        winner={done && !match.isBye && match.winnerId !== null && match.winnerId === match.p2}
      />

      {editable &&
        (editing ? (
          <ResultForm
            match={match}
            names={names}
            tournamentId={tournamentId}
            onClose={() => setEditing(false)}
          />
        ) : (
          <button type="button" className={`${btnGhost} mt-1 -ml-2 text-sm`} onClick={() => setEditing(true)}>
            {done ? copy.tournament.editResult : copy.tournament.enterResult}
          </button>
        ))}
    </div>
  );
}

function playerName(id: string | null, match: MatchRow, names: Record<string, string>): string {
  if (id) return names[id] ?? copy.tournament.unknownPlayer;
  return match.isBye ? copy.tournament.bye : copy.tournament.tbd;
}

function PlayerLine({
  name,
  legs,
  showLegs,
  winner,
}: {
  name: string;
  legs: number;
  showLegs: boolean;
  winner: boolean;
}) {
  return (
    <div className={`flex min-h-8 items-center justify-between gap-3 ${winner ? "font-bold text-cream" : ""}`}>
      <span className="truncate">
        {name}
        {winner && <span className="sr-only"> ({copy.tournament.winner})</span>}
      </span>
      {showLegs && <span className={`num text-xl ${winner ? "text-board-green" : "text-muted"}`}>{legs}</span>}
    </div>
  );
}

function ResultForm({
  match,
  names,
  tournamentId,
  onClose,
}: {
  match: MatchRow;
  names: Record<string, string>;
  tournamentId: string;
  onClose: () => void;
}) {
  const need = legsToWin(match.bestOf);
  const [legs, setLegs] = useState<[number, number]>(
    match.status === "done" ? [match.legsP1, match.legsP2] : [0, 0],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const finished = manualResultWinner(match.bestOf, legs[0], legs[1]) !== null;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await setMatchResult(tournamentId, match.id, legs[0], legs[1]);
      if (!result.ok) setError(result.message);
      else onClose();
    });
  }

  return (
    <div className="mt-2 space-y-3 border-t border-line pt-3">
      <p className="text-sm text-muted">{copy.tournament.resultHint(match.bestOf)}</p>
      {([0, 1] as const).map((side) => {
        const name = names[(side === 0 ? match.p1 : match.p2) ?? ""] ?? copy.tournament.unknownPlayer;
        return (
          <div key={side}>
            <span className="mb-1 block text-sm font-medium" id={`legs-${match.id}-${side}`}>
              {copy.tournament.legsFor(name)}
            </span>
            <div role="radiogroup" aria-labelledby={`legs-${match.id}-${side}`} className="flex flex-wrap gap-1.5">
              {Array.from({ length: need + 1 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={legs[side] === n}
                  onClick={() => setLegs(side === 0 ? [n, legs[1]] : [legs[0], n])}
                  className={`num min-h-11 min-w-11 rounded-md border text-lg font-bold ${
                    legs[side] === n
                      ? "border-gold bg-gold/20 text-cream"
                      : "border-line bg-surface-2 text-muted hover:text-cream"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {error && (
        <p className={alertError} role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className={btnPrimary} disabled={pending || !finished} onClick={save}>
          {pending ? copy.common.saving : copy.tournament.saveResult}
        </button>
        <button type="button" className={btnSecondary} onClick={onClose}>
          {copy.common.cancel}
        </button>
      </div>
    </div>
  );
}
