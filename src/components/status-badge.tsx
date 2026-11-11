import { copy } from "@/lib/copy";
import type { TournamentStatus } from "@/lib/domain/tournament";

const tone: Record<TournamentStatus, string> = {
  groups: "border-gold/60 text-gold",
  ko: "border-brand-red/70 text-alert",
  done: "border-line text-muted",
};

export function StatusBadge({ status }: { status: TournamentStatus }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase ${tone[status]}`}>
      {copy.tournaments.status[status]}
    </span>
  );
}
