"use client";

import { useState, useTransition } from "react";
import { alertError, btnPrimary, btnSecondary, card } from "@/components/ui";
import { copy } from "@/lib/copy";
import { startMatch } from "../actions";

export type QueueCard = {
  id: string;
  label: string;
  p1: string;
  p2: string;
  format: string;
  playable: boolean;
};

/** No live match on this board: the next match plus other waiting ones ("Play here"). */
export function BoardQueue({
  board,
  next,
  others,
  empty,
}: {
  board: number;
  next: QueueCard | null;
  others: QueueCard[];
  empty: string;
}) {
  return (
    <div className="space-y-6">
      {next ? (
        <section aria-labelledby="next-match" className={`${card} space-y-4 border-gold/50`}>
          <h2 id="next-match" className="text-sm font-semibold tracking-wide text-gold uppercase">
            {copy.board.nextMatch}
          </h2>
          <MatchStarter match={next} board={board} big />
        </section>
      ) : (
        <p className="text-muted">{empty}</p>
      )}

      {others.length > 0 && (
        <section aria-labelledby="other-waiting" className="space-y-2">
          <h2 id="other-waiting" className="font-display text-2xl font-bold uppercase">
            {copy.board.otherWaiting}
          </h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {others.map((m) => (
              <li key={m.id} className={card}>
                <MatchStarter match={m} board={board} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MatchStarter({ match, board, big = false }: { match: QueueCard; board: number; big?: boolean }) {
  const [choosing, setChoosing] = useState(big);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start(first: 0 | 1) {
    setError(null);
    startTransition(async () => {
      const result = await startMatch(match.id, board, first);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm text-muted">
          {match.label} · {match.format}
        </p>
        <p className={`font-semibold ${big ? "text-2xl sm:text-3xl" : "text-lg"}`}>
          {match.p1} <span className="text-muted">v</span> {match.p2}
        </p>
        {!match.playable && <p className="text-sm text-gold">{copy.board.playersBusy}</p>}
      </div>

      {choosing && match.playable ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{copy.board.whoStarts}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[match.p1, match.p2].map((name, side) => (
              <button
                key={side}
                type="button"
                className={`${btnPrimary} min-h-14 text-lg`}
                disabled={pending}
                onClick={() => start(side as 0 | 1)}
              >
                {pending ? copy.board.starting : copy.board.throwsFirst(name)}
              </button>
            ))}
          </div>
          {!big && (
            <button type="button" className={btnSecondary} onClick={() => setChoosing(false)}>
              {copy.common.cancel}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={`${btnSecondary} min-h-14`}
          disabled={!match.playable}
          onClick={() => setChoosing(true)}
        >
          {copy.board.playHere}
        </button>
      )}

      {error && (
        <p className={alertError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
