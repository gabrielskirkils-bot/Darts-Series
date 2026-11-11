// Shared Tailwind class sets. Tap targets are at least 44px tall.

export const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

// Primary actions wear the crest's beer gold; green is kept for wins only.
export const btnPrimary = `${btn} bg-gold text-bg shadow-sm shadow-black/30 hover:bg-gold/90`;
export const btnSecondary = `${btn} border border-line bg-surface-2 text-ink hover:border-muted`;
export const btnDanger = `${btn} bg-brand-red text-ink hover:bg-brand-red/85`;
export const btnGhost = `${btn} text-muted hover:bg-surface-2 hover:text-ink`;

export const input =
  "min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-ink placeholder:text-muted/70 focus:border-gold focus:outline-none";

export const label = "mb-1 block text-sm font-medium text-muted";

export const card = "rounded-xl border border-line bg-surface p-4 shadow-lg shadow-black/20 sm:p-5";

export const alertError = "rounded-lg border border-brand-red/60 bg-brand-red/10 px-3 py-2 text-sm text-ink";
export const alertWarn = "rounded-lg border border-gold/60 bg-gold/10 px-3 py-2 text-sm text-ink";
export const alertOk = "rounded-lg border border-win/60 bg-win/10 px-3 py-2 text-sm text-ink";
