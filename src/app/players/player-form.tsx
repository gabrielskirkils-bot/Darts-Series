"use client";

import { useActionState, useState } from "react";
import { alertError, alertOk, alertWarn, btnPrimary, btnSecondary, card, input, label } from "@/components/ui";
import { copy } from "@/lib/copy";
import { findDuplicateName } from "@/lib/domain/players";
import { createPlayer, updatePlayer, type ActionState } from "./actions";

type NamedPlayer = { id: string; name: string };

const initial: ActionState = { ok: false, message: null };

/** Controlled fields so values survive React's post-action form reset when saving fails. */
function NameFields({
  players,
  excludeId,
  defaults,
  autoFocus,
}: {
  players: NamedPlayer[];
  excludeId?: string;
  defaults?: { name: string; nickname: string | null };
  autoFocus?: boolean;
}) {
  const [name, setName] = useState(defaults?.name ?? "");
  const [nickname, setNickname] = useState(defaults?.nickname ?? "");
  const duplicate = findDuplicateName(name, players, excludeId);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="player-name" className={label}>
          {copy.players.name}
        </label>
        <input
          id="player-name"
          name="name"
          required
          maxLength={60}
          autoComplete="off"
          autoFocus={autoFocus}
          className={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-describedby={duplicate ? "player-name-dup" : undefined}
        />
      </div>
      <div>
        <label htmlFor="player-nickname" className={label}>
          {copy.players.nickname} <span className="font-normal">({copy.players.optional})</span>
        </label>
        <input
          id="player-nickname"
          name="nickname"
          maxLength={30}
          autoComplete="off"
          className={input}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>
      {duplicate && (
        <p id="player-name-dup" className={`${alertWarn} sm:col-span-2`} role="status">
          {copy.players.duplicateWarning(duplicate.name)}
        </p>
      )}
    </div>
  );
}

/** Collapsible "Add player" card for organizers on the player list. */
export function AddPlayerForm({ players }: { players: NamedPlayer[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createPlayer, initial);
  // A new id after each successful add remounts (clears) the fields.
  const fieldsKey = state.ok ? (state.id ?? "added") : "new";

  if (!open) {
    return (
      <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
        + {copy.players.add}
      </button>
    );
  }

  return (
    <form action={action} className={`${card} space-y-3`}>
      <h2 className="font-display text-xl font-bold uppercase">{copy.players.addTitle}</h2>
      <NameFields key={fieldsKey} players={players} autoFocus />
      {state.message && (
        <p className={state.ok ? alertOk : alertError} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? copy.common.saving : copy.players.add}
        </button>
        <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>
          {copy.common.cancel}
        </button>
      </div>
    </form>
  );
}

/** Edit name / nickname on the player page. */
export function EditPlayerForm({
  player,
  players,
}: {
  player: { id: string; name: string; nickname: string | null };
  players: NamedPlayer[];
}) {
  const [state, action, pending] = useActionState(updatePlayer.bind(null, player.id), initial);
  return (
    <form action={action} className="space-y-3">
      <NameFields players={players} excludeId={player.id} defaults={player} />
      {state.message && (
        <p className={state.ok ? alertOk : alertError} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      )}
      <button type="submit" className={btnPrimary} disabled={pending}>
        {pending ? copy.common.saving : copy.common.save}
      </button>
    </form>
  );
}
