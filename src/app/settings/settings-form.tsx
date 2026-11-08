"use client";

import { useState, useTransition, type FormEvent } from "react";
import { alertError, alertOk, btnGhost, btnPrimary, btnSecondary, card, input, label } from "@/components/ui";
import { copy } from "@/lib/copy";
import { BEST_OF_OPTIONS, START_SCORES } from "@/lib/domain/rules";
import { validateSettings, type AppSettings } from "@/lib/domain/settings";
import type { MatchFormats } from "@/lib/domain/structure";
import { saveSettings, type SaveState } from "./actions";

type Row = { key: number; place: string; pts: string };
type Stage = keyof MatchFormats;

const STAGES: Stage[] = ["group", "ko", "final"];
const select = `${input} pr-8`;

function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.points.map((r, i) => ({ key: i, place: String(r.place), pts: String(r.pts) })),
  );
  const [nextKey, setNextKey] = useState(initial.points.length);
  const [eloK, setEloK] = useState(String(initial.eloK));
  const [eloPlaceK, setEloPlaceK] = useState(String(initial.eloPlaceK));
  const [eloStart, setEloStart] = useState(String(initial.eloStart));
  const [boards, setBoards] = useState(initial.boards);
  const [askDoubles, setAskDoubles] = useState(initial.askDoubles);
  const [fmt, setFmt] = useState<MatchFormats>(initial.fmt);
  const [result, setResult] = useState<SaveState | null>(null);
  const [pending, startTransition] = useTransition();

  function build(): AppSettings {
    return {
      points: rows.map((r) => ({ place: toNumber(r.place), pts: toNumber(r.pts) })),
      eloK: toNumber(eloK),
      eloPlaceK: toNumber(eloPlaceK),
      eloStart: toNumber(eloStart),
      boards,
      askDoubles,
      fmt,
    };
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const settings = build();
    const errors = validateSettings(settings);
    if (errors.length) {
      setResult({ ok: false, message: copy.settings.errors[errors[0]!] });
      return;
    }
    setResult(null);
    startTransition(async () => {
      const res = await saveSettings(settings);
      setResult(res);
      if (res.ok) {
        const sorted = [...rows].sort((a, b) => toNumber(a.place) - toNumber(b.place));
        setRows(sorted);
      }
    });
  }

  function updateRow(key: number, field: "place" | "pts", value: string) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    const last = rows.reduce((max, r) => Math.max(max, toNumber(r.place) || 0), 0);
    setRows((rs) => [...rs, { key: nextKey, place: String(last ? last * 2 + 1 : 1), pts: "0" }]);
    setNextKey((k) => k + 1);
  }

  function setStage(stage: Stage, field: "start" | "bestOf", value: number) {
    setFmt((f) => ({ ...f, [stage]: { ...f[stage], [field]: value } }));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <section className={`${card} space-y-3`}>
        <h2 className="font-display text-xl font-bold uppercase">{copy.settings.points.title}</h2>
        <p className="text-sm text-muted">{copy.settings.points.intro}</p>
        <div className="max-w-sm space-y-2">
          <div className="grid grid-cols-[1fr_1fr_2.75rem] gap-2 text-sm text-muted">
            <span>{copy.settings.points.from}</span>
            <span>{copy.settings.points.pts}</span>
          </div>
          {rows.map((r, i) => (
            <div key={r.key} className="grid grid-cols-[1fr_1fr_2.75rem] gap-2">
              <input
                aria-label={`${copy.settings.points.from} (${i + 1})`}
                inputMode="numeric"
                className={`${input} num text-lg`}
                value={r.place}
                onChange={(e) => updateRow(r.key, "place", e.target.value)}
              />
              <input
                aria-label={`${copy.settings.points.pts} (${i + 1})`}
                inputMode="numeric"
                className={`${input} num text-lg`}
                value={r.pts}
                onChange={(e) => updateRow(r.key, "pts", e.target.value)}
              />
              <button
                type="button"
                className={`${btnGhost} px-0`}
                aria-label={`${copy.settings.points.remove} (${i + 1})`}
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className={btnSecondary} onClick={addRow}>
            + {copy.settings.points.add}
          </button>
        </div>
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-display text-xl font-bold uppercase">{copy.settings.formats.title}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STAGES.map((stage) => (
            <fieldset key={stage} className="space-y-2">
              <legend className="mb-1 font-semibold">{copy.settings.formats.stage[stage]}</legend>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`${stage}-start`} className={label}>
                    {copy.settings.formats.start}
                  </label>
                  <select
                    id={`${stage}-start`}
                    className={select}
                    value={fmt[stage].start}
                    onChange={(e) => setStage(stage, "start", Number(e.target.value))}
                  >
                    {START_SCORES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${stage}-bestof`} className={label}>
                    {copy.settings.formats.bestOf}
                  </label>
                  <select
                    id={`${stage}-bestof`}
                    className={select}
                    value={fmt[stage].bestOf}
                    onChange={(e) => setStage(stage, "bestOf", Number(e.target.value))}
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
          ))}
        </div>
      </section>

      <section className={`${card} grid gap-4 sm:grid-cols-3`}>
        <div className="space-y-2 sm:col-span-2">
          <h2 className="font-display text-xl font-bold uppercase">{copy.settings.elo.title}</h2>
          <div className="grid max-w-md grid-cols-3 gap-2">
            <div>
              <label htmlFor="elo-k" className={label}>
                {copy.settings.elo.k}
              </label>
              <input
                id="elo-k"
                inputMode="numeric"
                className={`${input} num text-lg`}
                value={eloK}
                onChange={(e) => setEloK(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="elo-place-k" className={label}>
                {copy.settings.elo.placeK}
              </label>
              <input
                id="elo-place-k"
                inputMode="numeric"
                className={`${input} num text-lg`}
                value={eloPlaceK}
                onChange={(e) => setEloPlaceK(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="elo-start" className={label}>
                {copy.settings.elo.start}
              </label>
              <input
                id="elo-start"
                inputMode="numeric"
                className={`${input} num text-lg`}
                value={eloStart}
                onChange={(e) => setEloStart(e.target.value)}
              />
            </div>
          </div>
          <p className="text-sm text-muted">{copy.settings.elo.note}</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="boards" className={label}>
            {copy.settings.boards}
          </label>
          <select id="boards" className={select} value={boards} onChange={(e) => setBoards(Number(e.target.value))}>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:col-span-3">
          <input
            type="checkbox"
            className="size-5 accent-board-green"
            checked={askDoubles}
            onChange={(e) => setAskDoubles(e.target.checked)}
          />
          {copy.settings.askDoubles}
        </label>
      </section>

      {result?.message && (
        <p className={result.ok ? alertOk : alertError} role={result.ok ? "status" : "alert"}>
          {result.message}
        </p>
      )}
      <button type="submit" className={btnPrimary} disabled={pending}>
        {pending ? copy.common.saving : copy.common.save}
      </button>
    </form>
  );
}
