import Link from "next/link";
import { copy } from "@/lib/copy";
import type { Period } from "@/lib/domain/points";

/** "All time" or a year, as links (`basePath?year=YYYY`). */
export function PeriodPicker({ basePath, years, period }: { basePath: string; years: number[]; period: Period }) {
  const options = [
    { href: basePath, label: copy.ranking.allTime, active: period.kind === "all" },
    ...years.map((y) => ({
      href: `${basePath}?year=${y}`,
      label: String(y),
      active: period.kind === "year" && period.year === y,
    })),
  ];
  return (
    <nav aria-label={copy.ranking.period} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          scroll={false}
          aria-current={o.active ? "page" : undefined}
          className={`flex min-h-11 items-center rounded-md px-4 text-sm font-semibold ${
            o.active ? "bg-surface-2 text-ink ring-1 ring-gold/60" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

/** The period from a `?year=` search param, if that year has finished tournaments. */
export function periodFromParam(param: string | string[] | undefined, years: number[]): Period {
  const year = Number(Array.isArray(param) ? param[0] : param);
  return years.includes(year) ? { kind: "year", year } : { kind: "all" };
}
