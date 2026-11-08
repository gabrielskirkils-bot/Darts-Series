/** The series plays in Riga; "today" for new tournaments uses this zone, not the server's. */
export const APP_TIME_ZONE = "Europe/Riga";

/** Calendar date (YYYY-MM-DD) of `now` in `timeZone`. */
export function dateInZone(now: Date, timeZone: string = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "8 Nov 2026" for an ISO date, independent of the viewer's locale. */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

/** "2 h 35 min" / "45 min". */
export function formatMinutes(total: number): string {
  const minutes = Math.max(0, Math.round(total));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
