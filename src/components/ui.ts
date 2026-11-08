// Shared Tailwind class sets. Tap targets are at least 44px tall.

export const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const btnPrimary = `${btn} bg-board-green text-cream hover:bg-board-green/85`;
export const btnSecondary = `${btn} border border-line bg-surface-2 text-cream hover:border-muted`;
export const btnDanger = `${btn} bg-board-red text-cream hover:bg-board-red/85`;
export const btnGhost = `${btn} text-muted hover:bg-surface-2 hover:text-cream`;

export const input =
  "min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-cream placeholder:text-muted/70 focus:border-gold focus:outline-none";

export const label = "mb-1 block text-sm font-medium text-muted";

export const card = "rounded-xl border border-line bg-surface p-4 sm:p-5";

export const alertError = "rounded-lg border border-board-red/60 bg-board-red/10 px-3 py-2 text-sm text-cream";
export const alertWarn = "rounded-lg border border-gold/60 bg-gold/10 px-3 py-2 text-sm text-cream";
export const alertOk = "rounded-lg border border-board-green/60 bg-board-green/10 px-3 py-2 text-sm text-cream";
