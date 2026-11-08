"use client";

import { useActionState, useMemo, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { Segmented, Stepper } from "@/components/controls";
import { alertError, alertOk, alertWarn, btnPrimary, btnSecondary, card, input, label } from "@/components/ui";
import { copy, roundLabelPlural } from "@/lib/copy";
import { roundNameFromEnd } from "@/lib/domain/bracket";
import type { Seeding } from "@/lib/domain/groups";
import { findDuplicateName, searchPlayers } from "@/lib/domain/players";
import { BEST_OF_OPTIONS, START_SCORES } from "@/lib/domain/rules";
import {
  previewStructure,
  suggestStructure,
  validateStructure,
  type Format,
  type MatchFormats,
  type StageFormat,
  type Structure,
} from "@/lib/domain/structure";
import { TOURNAMENT_NAME_MAX, type TournamentInput } from "@/lib/domain/tournament";
import { formatMinutes } from "@/lib/time";
import { createPlayer, type ActionState } from "@/app/players/actions";
import { createTournament } from "../actions";

type WizardPlayer = { id: string; name: string; nickname: string | null; elo: number };

type Defaults = { name: string; date: string; formats: MatchFormats; boards: number };

const FORMATS: Format[] = ["groups_ko", "ko", "rr"];
const sectionTitle = "font-display text-xl font-bold uppercase";

export function TournamentWizard({ players, defaults }: { players: WizardPlayer[]; defaults: Defaults }) {
  const [name, setName] = useState(defaults.name);
  const [date, setDate] = useState(defaults.date);
  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState<Structure | null>(null);
  const [seeding, setSeeding] = useState<Seeding>("elo");
  const [formats, setFormats] = useState<MatchFormats>(defaults.formats);
  const [boards, setBoards] = useState(defaults.boards);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const n = selected.length;
  // The suggestion follows the player count until the organizer edits the structure.
  const structure = manual ?? suggestStructure(n);
  const structureErrors = validateStructure(n, structure);
  const preview = structureErrors.length === 0 ? previewStructure(n, structure, formats, boards) : null;

  function editStructure(patch: Partial<Structure>) {
    setManual({ ...structure, ...patch });
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function submit() {
    setError(null);
    const payload: TournamentInput = {
      name,
      date,
      playerIds: selected,
      structure,
      seeding,
      formats,
      boards,
    };
    startTransition(async () => {
      const result = await createTournament(payload);
      // On success the action redirects to the new tournament.
      if (result && !result.ok) setError(result.message);
    });
  }

  const maxGroups = Math.max(1, Math.floor(n / 2));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="space-y-5">
        <section className={`${card} space-y-3`} aria-labelledby="w-details">
          <h2 id="w-details" className={sectionTitle}>
            {copy.wizard.sections.details}
          </h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <div>
              <label htmlFor="t-name" className={label}>
                {copy.wizard.name}
              </label>
              <input
                id="t-name"
                className={input}
                value={name}
                maxLength={TOURNAMENT_NAME_MAX}
                autoComplete="off"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="t-date" className={label}>
                {copy.wizard.date}
              </label>
              <input id="t-date" type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </section>

        <PlayerPicker players={players} selected={selected} onToggle={toggle} onSet={setSelected} />

        <section className={`${card} space-y-4`} aria-labelledby="w-structure">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="w-structure" className={sectionTitle}>
              {copy.wizard.sections.structure}
            </h2>
            {manual && (
              <button type="button" className={btnSecondary} onClick={() => setManual(null)}>
                {copy.wizard.suggest}
              </button>
            )}
          </div>
          <p className="text-sm text-muted">{manual ? copy.wizard.manualNote : copy.wizard.suggestedNote}</p>

          <Segmented
            label={copy.wizard.format}
            value={structure.format}
            options={FORMATS.map((f) => ({ value: f, label: copy.formatNames[f] }))}
            onChange={(format) =>
              editStructure(
                format === "groups_ko" && structure.format !== "groups_ko"
                  ? { ...suggestStructure(Math.max(n, 4)), format, thirdPlace: structure.thirdPlace }
                  : { format },
              )
            }
          />

          {structure.format === "rr" && <p className="text-sm text-muted">{copy.wizard.roundRobinNote}</p>}

          <div className="flex flex-wrap gap-x-8 gap-y-4">
            {structure.format === "groups_ko" && (
              <>
                <Stepper
                  label={copy.wizard.groups}
                  value={structure.groupCount}
                  min={1}
                  max={Math.max(maxGroups, structure.groupCount)}
                  onChange={(groupCount) => editStructure({ groupCount })}
                />
                <Stepper
                  label={copy.wizard.advance}
                  value={structure.advance}
                  min={1}
                  max={4}
                  onChange={(advance) => editStructure({ advance })}
                />
              </>
            )}
          </div>

          {structure.format !== "rr" && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-board-green"
                checked={structure.thirdPlace}
                onChange={(e) => editStructure({ thirdPlace: e.target.checked })}
              />
              {copy.wizard.thirdPlace}
            </label>
          )}

          <Segmented
            label={copy.wizard.seeding}
            value={seeding}
            options={[
              { value: "elo", label: copy.wizard.seedingOptions.elo },
              { value: "random", label: copy.wizard.seedingOptions.random },
            ]}
            onChange={setSeeding}
          />
        </section>

        <section className={`${card} space-y-4`} aria-labelledby="w-formats">
          <h2 id="w-formats" className={sectionTitle}>
            {copy.wizard.sections.formats}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {structure.format !== "ko" && (
              <StageFields
                id="group"
                title={structure.format === "rr" ? copy.wizard.stageRr : copy.settings.formats.stage.group}
                value={formats.group}
                onChange={(group) => setFormats({ ...formats, group })}
              />
            )}
            {structure.format !== "rr" && (
              <>
                <StageFields
                  id="ko"
                  title={copy.settings.formats.stage.ko}
                  value={formats.ko}
                  onChange={(ko) => setFormats({ ...formats, ko })}
                />
                <StageFields
                  id="final"
                  title={copy.settings.formats.stage.final}
                  value={formats.final}
                  onChange={(final) => setFormats({ ...formats, final })}
                />
              </>
            )}
          </div>
        </section>

        <section className={`${card} space-y-3`} aria-labelledby="w-boards">
          <h2 id="w-boards" className={sectionTitle}>
            {copy.wizard.sections.boards}
          </h2>
          <Stepper label={copy.wizard.boards} value={boards} min={1} max={8} onChange={setBoards} />
        </section>
      </div>

      <aside className={`${card} space-y-4 lg:sticky lg:top-4`} aria-labelledby="w-preview">
        <h2 id="w-preview" className={sectionTitle}>
          {copy.wizard.sections.preview}
        </h2>
        <p className="num text-3xl font-bold">{copy.tournaments.playerCount(n)}</p>
        {n < 2 ? (
          <p className="text-muted">{copy.wizard.preview.selectPlayers}</p>
        ) : preview ? (
          <PreviewLines preview={preview} format={structure.format} n={n} />
        ) : (
          <ul className="space-y-2">
            {structureErrors.map((e) => (
              <li key={e} className={alertWarn}>
                {copy.structureErrors[e]}
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className={alertError} role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className={`${btnPrimary} w-full min-h-14 text-lg`}
          disabled={pending || !preview}
          onClick={submit}
        >
          {pending ? copy.wizard.creating : copy.wizard.submit}
        </button>
      </aside>
    </div>
  );
}

function PreviewLines({
  preview,
  format,
  n,
}: {
  preview: ReturnType<typeof previewStructure>;
  format: Format;
  n: number;
}) {
  const sizes = [...preview.groupSizes].sort((a, b) => b - a);
  const showSplit = preview.groupMinutes > 0 && preview.knockoutMinutes > 0;
  return (
    <div className="space-y-2" aria-live="polite">
      {format === "rr" && <p>{copy.wizard.preview.roundRobin(n)}</p>}
      {format === "groups_ko" && <p>{copy.wizard.preview.groups(sizes)}</p>}
      {preview.rounds > 0 && (
        <p>
          {copy.wizard.preview.bracket(roundLabelPlural(roundNameFromEnd(preview.rounds)), preview.byes)}
          {preview.hasThirdPlace && <span className="text-muted">, {copy.wizard.preview.thirdPlace}</span>}
        </p>
      )}
      <p>{copy.wizard.preview.matches(preview.totalMatches)}</p>
      <div className="border-t border-line pt-3">
        <p className="text-sm text-muted">{copy.wizard.preview.duration}</p>
        <p className="num text-3xl font-bold">{formatMinutes(preview.totalMinutes)}</p>
        {showSplit && (
          <p className="text-sm text-muted">
            {copy.wizard.preview.split(formatMinutes(preview.groupMinutes), formatMinutes(preview.knockoutMinutes))}
          </p>
        )}
      </div>
    </div>
  );
}

function StageFields({
  id,
  title,
  value,
  onChange,
}: {
  id: string;
  title: string;
  value: StageFormat;
  onChange: (value: StageFormat) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 font-semibold">{title}</legend>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`f-${id}-start`} className={label}>
            {copy.settings.formats.start}
          </label>
          <select
            id={`f-${id}-start`}
            className={input}
            value={value.start}
            onChange={(e) => onChange({ ...value, start: Number(e.target.value) })}
          >
            {START_SCORES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`f-${id}-bo`} className={label}>
            {copy.settings.formats.bestOf}
          </label>
          <select
            id={`f-${id}-bo`}
            className={input}
            value={value.bestOf}
            onChange={(e) => onChange({ ...value, bestOf: Number(e.target.value) })}
          >
            {BEST_OF_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>
    </fieldset>
  );
}

const initialAdd: ActionState = { ok: false, message: null };

function PlayerPicker({
  players,
  selected,
  onToggle,
  onSet,
}: {
  players: WizardPlayer[];
  selected: string[];
  onToggle: (id: string) => void;
  onSet: Dispatch<SetStateAction<string[]>>;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => searchPlayers(players, query), [players, query]);
  const selectedSet = new Set(selected);

  return (
    <section className={`${card} space-y-3`} aria-labelledby="w-players">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="w-players" className={sectionTitle}>
          {copy.wizard.sections.players}
        </h2>
        <span className="num text-xl font-bold text-gold" aria-live="polite">
          {copy.wizard.selected(selected.length)}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="w-search" className={label}>
            {copy.wizard.search}
          </label>
          <input
            id="w-search"
            type="search"
            className={input}
            placeholder={copy.wizard.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={btnSecondary}
            disabled={shown.length === 0}
            onClick={() => onSet([...new Set([...selected, ...shown.map((p) => p.id)])])}
          >
            {copy.wizard.selectShown}
          </button>
          <button type="button" className={btnSecondary} disabled={selected.length === 0} onClick={() => onSet([])}>
            {copy.wizard.clear}
          </button>
        </div>
      </div>

      {players.length === 0 ? (
        <p className="text-muted">{copy.wizard.noPlayers}</p>
      ) : shown.length === 0 ? (
        <p className="text-muted">{copy.wizard.noMatches}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {shown.map((p) => {
            const on = selectedSet.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(p.id)}
                  className={`min-h-11 rounded-full border px-4 text-left font-medium transition-colors ${
                    on
                      ? "border-board-green bg-board-green/20 text-cream"
                      : "border-line bg-surface-2 text-muted hover:text-cream"
                  }`}
                >
                  <span aria-hidden>{on ? "✓ " : ""}</span>
                  {p.name}
                  {p.nickname && <span className="ml-1 text-sm text-muted">“{p.nickname}”</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <QuickAdd players={players} onAdded={(id) => onSet((s) => (s.includes(id) ? s : [...s, id]))} />
    </section>
  );
}

/** Inline "add new player"; the new player is selected right away. */
function QuickAdd({ players, onAdded }: { players: WizardPlayer[]; onAdded: (id: string) => void }) {
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createPlayer(prev, formData);
    if (result.ok && result.id) {
      onAdded(result.id);
      setName("");
    }
    return result;
  }, initialAdd);
  const duplicate = findDuplicateName(name, players);

  return (
    <form action={action} className="space-y-2 border-t border-line pt-3">
      <label htmlFor="w-quick-add" className={label}>
        {copy.wizard.quickAdd}
      </label>
      <div className="flex gap-2">
        <input
          id="w-quick-add"
          name="name"
          required
          maxLength={60}
          autoComplete="off"
          className={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className={`${btnSecondary} shrink-0`} disabled={pending || !name.trim()}>
          {pending ? copy.common.saving : copy.players.add}
        </button>
      </div>
      {duplicate && (
        <p className={alertWarn} role="status">
          {copy.players.duplicateWarning(duplicate.name)}
        </p>
      )}
      {state.message && (
        <p className={state.ok ? alertOk : alertError} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
