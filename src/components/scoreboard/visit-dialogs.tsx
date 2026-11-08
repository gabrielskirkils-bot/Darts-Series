"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { copy } from "@/lib/copy";

const option =
  "num min-h-16 min-w-16 flex-1 rounded-xl border border-line bg-surface-2 text-3xl font-bold hover:border-gold focus-visible:border-gold";

function Modal({ title, children, onCancel }: { title: string; children: ReactNode; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="visit-dialog-title"
        className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-2xl"
      >
        <h2 id="visit-dialog-title" className="font-display text-2xl font-bold uppercase">
          {title}
        </h2>
        {children}
        <button
          type="button"
          onClick={onCancel}
          className="min-h-14 w-full rounded-xl border border-line text-lg font-semibold text-muted hover:text-cream"
        >
          {copy.scoring.cancel}
        </button>
      </div>
    </div>
  );
}

function Choices({
  label,
  values,
  onPick,
  autoFocus,
}: {
  label: string;
  values: number[];
  onPick: (n: number) => void;
  autoFocus?: boolean;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoFocus) first.current?.focus();
  }, [autoFocus, values]);
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-lg font-semibold">{label}</legend>
      <div className="flex gap-2">
        {values.map((n, i) => (
          <button key={n} ref={i === 0 ? first : undefined} type="button" className={option} onClick={() => onPick(n)}>
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Escape cancels; a digit picks that option if offered. */
function useDialogKeys(values: number[], onPick: (n: number) => void, onCancel: () => void) {
  const latest = useRef({ values, onPick, onCancel });
  useEffect(() => {
    latest.current = { values, onPick, onCancel };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const { values: vs, onPick: pick, onCancel: cancel } = latest.current;
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      } else if (/^[0-9]$/.test(e.key) && vs.includes(Number(e.key))) {
        e.preventDefault();
        pick(Number(e.key));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Checkout: "Darts used this visit?" (minimum…3), then "Darts at double?" (1…darts used). */
export function CheckoutDialog({
  score,
  minDarts,
  onSave,
  onCancel,
}: {
  score: number;
  minDarts: number;
  onSave: (darts: number, dartsAtDouble: number) => void;
  onCancel: () => void;
}) {
  const [darts, setDarts] = useState<number | null>(minDarts === 3 ? 3 : null);

  function pickDarts(n: number) {
    if (n === 1) onSave(1, 1);
    else setDarts(n);
  }

  const values = darts === null ? range(minDarts, 3) : range(1, darts);
  useDialogKeys(values, darts === null ? pickDarts : (n) => onSave(darts, n), onCancel);

  return (
    <Modal title={copy.scoring.checkoutTitle(score)} onCancel={onCancel}>
      {darts === null ? (
        <Choices label={copy.scoring.dartsUsed} values={values} onPick={pickDarts} autoFocus />
      ) : (
        <Choices label={copy.scoring.dartsAtDouble} values={values} onPick={(n) => onSave(darts, n)} autoFocus />
      )}
    </Modal>
  );
}

/** Non-checkout visit starting on ≤ 50: one tap on 0–3 saves. */
export function DoublesDialog({
  score,
  bust,
  onSave,
  onCancel,
}: {
  score: number;
  bust: boolean;
  onSave: (dartsAtDouble: number) => void;
  onCancel: () => void;
}) {
  const values = range(0, 3);
  useDialogKeys(values, onSave, onCancel);
  return (
    <Modal title={bust ? copy.scoring.bustTitle(score) : copy.scoring.doublesTitle(score)} onCancel={onCancel}>
      <Choices label={copy.scoring.dartsAtDouble} values={values} onPick={onSave} autoFocus />
    </Modal>
  );
}
