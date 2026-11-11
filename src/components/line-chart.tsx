"use client";

import { useId, useState } from "react";
import { formatAverage, formatElo } from "@/lib/copy";

export type LinePoint = { label: string; value: number };

// A narrow viewBox keeps the 13px axis text readable when scaled to a phone width.
const W = 400;
const H = 190;
const PAD = { top: 14, right: 14, bottom: 26, left: 42 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/**
 * Single-series line chart (inline SVG, no legend: the title names the series).
 * 2px line, 8px markers, recessive grid; hover or focus a point for its value.
 */
export function LineChart({
  title,
  points,
  kind,
}: {
  title: string;
  points: LinePoint[];
  /** How values are shown (a name, since functions can't cross from server to client). */
  kind: "elo" | "average";
}) {
  const format = kind === "elo" ? formatElo : formatAverage;
  const id = useId();
  const [active, setActive] = useState<number | null>(null);

  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.max(1, Math.abs(hi) * 0.05);
  const yMin = lo - span * 0.15;
  const yMax = hi + span * 0.15;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const shown = active === null ? null : points[active];

  return (
    <figure className="space-y-2 rounded-xl border border-line bg-surface p-3 sm:p-4" aria-labelledby={`${id}-title`}>
      <div className="flex min-h-6 flex-wrap items-baseline justify-between gap-2">
        <figcaption id={`${id}-title`} className="text-sm font-semibold tracking-wide text-muted uppercase">
          {title}
        </figcaption>
        <p className="text-sm" aria-live="polite">
          {shown && (
            <>
              <span className="text-muted">{shown.label} Â· </span>
              <span className="num text-base font-bold">{format(shown.value)}</span>
            </>
          )}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-labelledby={`${id}-title`}>
        {niceTicks(yMin, yMax).map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--sal-line)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={13} fill="var(--sal-muted)">
              {format(t)}
            </text>
          </g>
        ))}
        {points.length > 0 && (
          <>
            <text x={x(0)} y={H - 8} textAnchor="start" fontSize={13} fill="var(--sal-muted)">
              {points[0]!.label}
            </text>
            {points.length > 1 && (
              <text x={x(points.length - 1)} y={H - 8} textAnchor="end" fontSize={13} fill="var(--sal-muted)">
                {points.at(-1)!.label}
              </text>
            )}
          </>
        )}
        <path d={path} fill="none" stroke="var(--sal-gold)" strokeWidth={2} strokeLinejoin="round" />
        {active !== null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="var(--sal-muted)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={4}
              fill="var(--sal-gold)"
              stroke="var(--sal-surface)"
              strokeWidth={2}
            />
            {/* Larger invisible hit target for hover, tap and keyboard focus. */}
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={14}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${p.label}: ${format(p.value)}`}
              className="cursor-pointer outline-none focus-visible:stroke-gold"
              strokeWidth={2}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(i)}
            />
          </g>
        ))}
      </svg>
    </figure>
  );
}
