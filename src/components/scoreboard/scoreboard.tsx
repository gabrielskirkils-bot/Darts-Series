"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { abandonMatch, confirmMatch } from "@/app/t/[id]/board/actions";
import { alertError, btnDanger, btnSecondary } from "@/components/ui";
import { copy, formatAverage } from "@/lib/copy";
import { suggestCheckout } from "@/lib/domain/checkout";
import {
  buildVisit,
  lastVisit,
  legHistory,
  matchState,
  matchSummary,
  planVisit,
  type HistoryRow,
  type MatchSetup,
  type Side,
  type SideSummary,
  type VisitInput,
} from "@/lib/domain/match";
import type { MatchVisits } from "@/lib/supabase/visits";
import { useMatchSync } from "./use-match-sync";
import { CheckoutDialog, DoublesDialog } from "./visit-dialogs";

type Dialog = { kind: "checkout"; score: number; minDarts: number } | { kind: "doubles"; score: number; bust: boolean };

const MAX_DIGITS = 3;
const key =
  "num flex min-h-14 items-center justify-center rounded-xl border border-line bg-surface-2 text-3xl font-bold select-none active:bg-line lg:min-h-16 disabled:opacity-40";

export function Scoreboard({
  tournamentId,
  matchId,
  label,
  players,
  startScore,
  bestOf,
  askDoubles,
  initial,
}: {
  tournamentId: string;
  matchId: string;
  label: string;
  players: [string, string];
  startScore: number;
  bestOf: number;
  askDoubles: boolean;
  initial: MatchVisits;
}) {
  const setup: MatchSetup = useMemo(
    () => ({ startScore, bestOf, firstStarter: initial.firstStarter }),
    [startScore, bestOf, initial.firstStarter],
  );
  const { db, visits, run, flush, error, clearError } = useMatchSync(matchId, initial.visits);
  const state = useMemo(() => matchState(setup, visits), [setup, visits]);
  const summary = useMemo(() => matchSummary(visits), [visits]);
  const history = useMemo(() => legHistory(setup, state), [setup, state]);

  const [entry, setEntry] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [abandoning, setAbandoning] = useState(false);
  const [busy, startAction] = useTransition();

  const toThrow = state.toThrow;
  const over = state.winner !== null;

  function save(input: VisitInput) {
    let visit;
    try {
      visit = buildVisit(state, input);
    } catch {
      setMessage(copy.scoring.impossibleScore);
      return;
    }
    const starter = state.currentLeg.starter;
    run({ kind: "add", visit }, () =>
      db.rpc("record_visit", {
        p_match: matchId,
        p_leg_no: visit.legNo,
        p_seq: visit.seq,
        p_player: visit.player,
        p_score: visit.score,
        p_darts: visit.darts,
        p_darts_at_double: visit.dartsAtDouble,
        p_bust: visit.bust,
        p_is_checkout: visit.isCheckout,
        p_starter: starter,
      }),
    );
    setDialog(null);
    setEntry("");
    setMessage(null);
  }

  function submit(score: number) {
    clearError();
    setMessage(null);
    const plan = planVisit(state, score, askDoubles);
    switch (plan.kind) {
      case "invalid":
        setMessage(copy.scoring.impossibleScore);
        setEntry("");
        return;
      case "cantCheckout":
        setMessage(copy.scoring.cantCheckout(plan.remaining));
        setEntry("");
        return;
      case "matchOver":
        return;
      case "checkout":
        setDialog({ kind: "checkout", score, minDarts: plan.minDarts });
        return;
      case "save":
        if (plan.askDoubles) setDialog({ kind: "doubles", score, bust: plan.bust });
        else save({ score });
    }
  }

  function undo() {
    clearError();
    setMessage(null);
    const last = lastVisit(visits);
    if (!last) return;
    run({ kind: "undo", legNo: last.legNo, seq: last.seq }, () =>
      db.rpc("undo_visit", { p_match: matchId, p_leg_no: last.legNo, p_seq: last.seq }),
    );
  }

  function typeDigit(d: string) {
    setMessage(null);
    setEntry((e) => (e.length >= MAX_DIGITS ? e : e === "0" ? d : e + d));
  }

  function enter() {
    if (entry !== "") submit(Number(entry));
  }

  function backspace() {
    setEntry((v) => v.slice(0, -1));
  }

  function clearEntry() {
    setEntry("");
  }

  function confirm() {
    setActionError(null);
    startAction(async () => {
      await flush();
      const result = await confirmMatch(tournamentId, matchId);
      if (!result.ok) setActionError(result.message);
    });
  }

  function abandon() {
    setActionError(null);
    startAction(async () => {
      await flush();
      const result = await abandonMatch(matchId);
      if (!result.ok) setActionError(result.message);
    });
  }

  // Physical keyboard: digits, Enter, Backspace, Escape, Ctrl+Z. Dialogs handle their own keys.
  const keys = useRef({ typeDigit, enter, undo, backspace, clearEntry, dialog, over });
  useEffect(() => {
    keys.current = { typeDigit, enter, undo, backspace, clearEntry, dialog, over };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = keys.current;
      if (k.dialog) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        k.undo();
        return;
      }
      if (k.over || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        k.typeDigit(e.key);
      } else if (e.key === "Enter") {
        e.preventDefault();
        k.enter();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        k.backspace();
      } else if (e.key === "Escape") {
        k.clearEntry();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // On a phone the site header pushes the keypad down; start with the scoreboard in view.
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    top.current?.scrollIntoView({ block: "start" });
  }, []);

  const shownError = error ?? actionError;

  return (
    <div ref={top} className="scroll-mt-2 space-y-3">
      <p className="text-sm text-muted">
        {label} · {copy.scoring.legInfo(state.currentLeg.legNo, bestOf, startScore)}
      </p>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {([0, 1] as const).map((side) => (
              <PlayerPanel
                key={side}
                name={players[side]}
                remaining={state.remaining[side]}
                legs={state.legsWon[side]}
                darts={state.dartsThisLeg[side]}
                summary={summary[side]}
                active={!over && toThrow === side}
                starter={state.currentLeg.starter === side}
              />
            ))}
          </div>
          <div className="hidden lg:block">
            <History rows={history} players={players} />
          </div>
        </div>

        <div className="space-y-2">
          <div
            className="flex min-h-16 items-center justify-between rounded-xl border border-line bg-bg px-4"
            aria-live="polite"
          >
            <span className="text-sm text-muted">{copy.scoring.enterScore(players[toThrow])}</span>
            <output aria-label={copy.scoring.scoreLabel} className="num text-5xl font-bold">
              {entry || "–"}
            </output>
          </div>
          {(message || shownError) && (
            <p className={alertError} role="alert">
              {message ?? shownError}
            </p>
          )}

          <div role="group" aria-label={copy.scoring.quick} className="grid grid-cols-5 gap-1.5">
            {copy.scoring.quickScores.map((s) => (
              <button key={s} type="button" className={`${key} text-xl`} disabled={over} onClick={() => submit(s)}>
                {s}
              </button>
            ))}
            <button
              type="button"
              className={`${key} text-base font-semibold`}
              disabled={visits.length === 0}
              onClick={undo}
              aria-label={copy.scoring.undo}
            >
              {copy.scoring.undoShort}
            </button>
          </div>

          <div role="group" aria-label={copy.scoring.keypad} className="grid grid-cols-3 gap-1.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} type="button" className={key} disabled={over} onClick={() => typeDigit(d)}>
                {d}
              </button>
            ))}
            <button
              type="button"
              className={key}
              disabled={over || entry === ""}
              onClick={backspace}
              aria-label={copy.scoring.backspace}
            >
              ⌫
            </button>
            <button type="button" className={key} disabled={over} onClick={() => typeDigit("0")}>
              0
            </button>
            <button
              type="button"
              className={`${key} border-board-green bg-board-green text-xl text-cream active:bg-board-green/80`}
              disabled={over || entry === ""}
              onClick={enter}
            >
              {copy.scoring.enter}
            </button>
          </div>
          <p className="hidden text-xs text-muted lg:block">{copy.scoring.keyboardHint}</p>
        </div>
      </div>

      <div className="lg:hidden">
        <History rows={history} players={players} />
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        {abandoning ? (
          <div className="space-y-2">
            <p className="text-sm text-board-red">{copy.scoring.abandonWarning}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnDanger} disabled={busy} onClick={abandon}>
                {copy.scoring.confirmAbandon}
              </button>
              <button type="button" className={btnSecondary} onClick={() => setAbandoning(false)}>
                {copy.common.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={btnSecondary} onClick={() => setAbandoning(true)}>
            {copy.scoring.abandon}
          </button>
        )}
      </div>

      {dialog?.kind === "checkout" && (
        <CheckoutDialog
          score={dialog.score}
          minDarts={dialog.minDarts}
          onSave={(darts, dartsAtDouble) => save({ score: dialog.score, darts, dartsAtDouble })}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "doubles" && (
        <DoublesDialog
          score={dialog.score}
          bust={dialog.bust}
          onSave={(dartsAtDouble) => save({ score: dialog.score, dartsAtDouble })}
          onCancel={() => setDialog(null)}
        />
      )}

      {over && (
        <MatchOver
          winner={players[state.winner!]}
          legs={state.legsWon}
          players={players}
          summary={summary}
          busy={busy}
          error={shownError}
          onUndo={undo}
          onConfirm={confirm}
        />
      )}
    </div>
  );
}

function PlayerPanel({
  name,
  remaining,
  legs,
  darts,
  summary,
  active,
  starter,
}: {
  name: string;
  remaining: number;
  legs: number;
  darts: number;
  summary: SideSummary;
  active: boolean;
  starter: boolean;
}) {
  const route = remaining <= 170 ? suggestCheckout(remaining) : null;
  return (
    <section
      aria-label={name}
      aria-current={active ? "true" : undefined}
      className={`relative flex flex-col rounded-xl border p-3 transition-colors sm:p-4 ${
        active ? "border-gold bg-surface-2 ring-2 ring-gold" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="truncate text-base font-semibold sm:text-xl">
          {starter && (
            <span className="mr-1 text-board-red" aria-hidden>
              ●
            </span>
          )}
          {name}
        </h2>
        <span className="num shrink-0 rounded-md bg-bg px-2 text-2xl font-bold" aria-label={`${copy.scoring.legs} ${legs}`}>
          {legs}
        </span>
      </div>
      {active && <span className="text-xs font-semibold tracking-wide text-gold uppercase">{copy.scoring.toThrow}</span>}
      <p className="num my-1 text-6xl leading-none font-bold sm:text-7xl lg:text-8xl">{remaining}</p>
      <p className="text-xs text-muted sm:text-sm">
        {copy.scoring.average} <span className="num text-cream">{formatAverage(summary.average)}</span> ·{" "}
        {copy.scoring.darts(darts)}
      </p>
      <p className="num mt-1 min-h-6 text-sm font-semibold text-board-green sm:text-base">
        {route && (
          <>
            <span className="sr-only">{copy.scoring.checkoutHint}: </span>
            {route.join(" ")}
          </>
        )}
      </p>
    </section>
  );
}

function History({ rows, players }: { rows: HistoryRow[]; players: [string, string] }) {
  return (
    <section aria-labelledby="leg-history" className="rounded-xl border border-line bg-surface p-3">
      <h2 id="leg-history" className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
        {copy.scoring.history}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{copy.scoring.noVisits}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {([0, 1] as Side[]).map((side) => (
            <ol key={side} aria-label={players[side]} className="space-y-0.5">
              {rows
                .filter((r) => r.player === side)
                .map((r) => (
                  <li key={`${r.legNo}-${r.seq}`} className="num flex justify-between text-lg">
                    <span className={r.bust ? "text-board-red" : r.isCheckout ? "text-board-green" : ""}>
                      {r.bust ? copy.scoring.bustEntry(r.score) : r.score}
                    </span>
                    <span className="text-muted">{r.remainingAfter}</span>
                  </li>
                ))}
            </ol>
          ))}
        </div>
      )}
    </section>
  );
}

function MatchOver({
  winner,
  legs,
  players,
  summary,
  busy,
  error,
  onUndo,
  onConfirm,
}: {
  winner: string;
  legs: [number, number];
  players: [string, string];
  summary: [SideSummary, SideSummary];
  busy: boolean;
  error: string | null;
  onUndo: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => confirmRef.current?.focus(), []);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-over-title"
        className="w-full max-w-lg space-y-4 rounded-2xl border border-gold/60 bg-surface p-5 text-center shadow-2xl"
      >
        <h2 id="match-over-title" className="font-display text-4xl font-bold uppercase">
          {copy.scoring.matchWon(winner)}
        </h2>
        <p className="num text-6xl font-bold">
          {legs[0]}–{legs[1]}
        </p>
        <ul className="space-y-1 text-sm text-muted">
          {([0, 1] as const).map((side) => (
            <li key={side}>
              <span className="font-semibold text-cream">{players[side]}</span> ·{" "}
              {copy.scoring.statLine(
                formatAverage(summary[side].average),
                summary[side].t180,
                summary[side].highestCheckout,
              )}
            </li>
          ))}
        </ul>
        {error && (
          <p className={alertError} role="alert">
            {error}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" className={`${btnSecondary} min-h-14 text-lg`} disabled={busy} onClick={onUndo}>
            {copy.scoring.undo}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="inline-flex min-h-14 items-center justify-center rounded-lg bg-board-green px-4 text-lg font-semibold text-cream hover:bg-board-green/85 disabled:opacity-50"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? copy.scoring.confirming : copy.scoring.confirmResult}
          </button>
        </div>
      </div>
    </div>
  );
}
