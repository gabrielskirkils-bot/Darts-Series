"use client";

import { useState, useTransition } from "react";
import { alertError, btnDanger, btnSecondary } from "@/components/ui";
import { copy } from "@/lib/copy";
import { deletePlayer, setPlayerActive } from "../actions";

/** Archive / restore and (for players without tournaments) delete with confirmation. */
export function PlayerAdminActions({ id, active, canDelete }: { id: string; active: boolean; canDelete: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnSecondary}
          disabled={pending}
          onClick={() => run(() => setPlayerActive(id, !active))}
        >
          {active ? copy.players.archive : copy.players.restore}
        </button>
        {canDelete &&
          (confirming ? (
            <>
              <button type="button" className={btnDanger} disabled={pending} onClick={() => run(() => deletePlayer(id))}>
                {copy.players.confirmDelete}
              </button>
              <button type="button" className={btnSecondary} onClick={() => setConfirming(false)}>
                {copy.common.cancel}
              </button>
            </>
          ) : (
            <button type="button" className={btnSecondary} onClick={() => setConfirming(true)}>
              {copy.players.delete}
            </button>
          ))}
      </div>
      <p className="text-sm text-muted">{canDelete ? copy.players.deleteHint : copy.players.cannotDelete}</p>
      <p className="text-sm text-muted">{copy.players.archivedNote}</p>
      {error && (
        <p className={alertError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
