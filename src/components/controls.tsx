"use client";

import { useId } from "react";
import { copy } from "@/lib/copy";

/** Segmented single choice (radio-like buttons). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div>
      <span id={id} className="mb-1 block text-sm font-medium text-muted">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap rounded-lg border border-line p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-h-11 flex-1 rounded-md px-3 text-sm font-medium ${
              value === o.value ? "bg-surface-2 text-cream ring-1 ring-gold/60" : "text-muted hover:text-cream"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Number with − / + buttons. */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const btn =
    "flex size-11 items-center justify-center rounded-md border border-line bg-surface-2 text-xl font-bold disabled:opacity-40";
  return (
    <div>
      <span id={id} className="mb-1 block text-sm font-medium text-muted">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex items-center gap-2">
        <button
          type="button"
          className={btn}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={copy.wizard.decrease(label)}
        >
          −
        </button>
        <output aria-live="polite" className="num min-w-10 text-center text-2xl font-bold">
          {value}
        </output>
        <button
          type="button"
          className={btn}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={copy.wizard.increase(label)}
        >
          +
        </button>
      </div>
    </div>
  );
}
