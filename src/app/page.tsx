import Link from "next/link";
import { Suspense } from "react";
import { PeriodPicker, periodFromParam } from "@/components/period-picker";
import { alertError } from "@/components/ui";
import { copy, formatAverage, formatElo, formatEloChange } from "@/lib/copy";
import type { Movement } from "@/lib/domain/points";
import { rankingView, rankingYears, type RankingView } from "@/lib/domain/ranking";
import { getRankingData, type PlayerName } from "@/lib/supabase/ranking";
import { formatDate } from "@/lib/time";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl font-bold tracking-wide uppercase">{copy.home.title}</h1>
      <Suspense fallback={<p className="text-muted">{copy.home.loading}</p>}>
        <Ranking searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Ranking({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [params, data] = await Promise.all([searchParams, getRankingData().catch(() => null)]);
  if (!data) return <p className={alertError}>{copy.home.loadError}</p>;

  const years = rankingYears(data.tournaments);
  const period = periodFromParam(params.year, years);
  const view = rankingView(data, period);
  const name = (id: string) => data.players.get(id)?.name ?? "";

  return (
    <div className="space-y-6">
      {data.inProgress && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-board-red/60 bg-board-red/10 p-4">
          <p className="font-semibold">
            <span className="mr-2 text-board-red" aria-hidden>
              ●
            </span>
            {copy.ranking.inProgress(data.inProgress.name)}
          </p>
          <div className="flex gap-2">
            <Link href={`/t/${data.inProgress.id}`} className="rounded-lg bg-board-red px-4 py-2.5 font-semibold">
              {copy.ranking.openTournament}
            </Link>
            <Link href={`/t/${data.inProgress.id}/tv`} className="rounded-lg border border-line px-4 py-2.5 font-semibold">
              {copy.ranking.watchTv}
            </Link>
          </div>
        </section>
      )}

      {data.tournaments.length === 0 ? (
        <Onboarding />
      ) : (
        <>
          <PeriodPicker basePath="/" years={years} period={period} />
          <Summary view={view} name={name} />
          {view.last && view.last.podium.length > 0 && <Podium view={view} name={name} />}
          {view.rows.length === 0 ? (
            <p className="text-muted">{copy.ranking.noResults}</p>
          ) : (
            <RankingTable view={view} players={data.players} />
          )}
        </>
      )}
    </div>
  );
}

function Summary({ view, name }: { view: RankingView; name: (id: string) => string }) {
  const s = view.summary;
  const tiles = [
    { label: copy.ranking.summary.tournaments, value: String(s.tournaments) },
    { label: copy.ranking.summary.matches, value: String(s.matches) },
    { label: copy.ranking.summary.t180, value: String(s.t180) },
    {
      label: copy.ranking.summary.highestCheckout,
      value: s.highestCheckout ? String(s.highestCheckout.score) : "–",
      sub: s.highestCheckout ? copy.ranking.summary.by(name(s.highestCheckout.playerId)) : undefined,
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg border border-line bg-surface p-3 sm:p-4">
          <dt className="text-sm text-muted">{t.label}</dt>
          <dd>
            <span className="num block text-3xl font-bold sm:text-4xl">{t.value}</span>
            {t.sub && <span className="text-sm text-muted">{t.sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Podium({ view, name }: { view: RankingView; name: (id: string) => string }) {
  const last = view.last!;
  const medal = ["text-gold", "text-cream", "text-bronze"];
  return (
    <section aria-labelledby="podium-title" className="rounded-xl border border-line bg-surface p-4">
      <h2 id="podium-title" className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
        <Link href={`/t/${last.tournament.id}`} className="hover:text-cream">
          {copy.ranking.podium(last.tournament.name)} · {formatDate(last.tournament.date)}
        </Link>
      </h2>
      <ol className="grid gap-2 sm:grid-cols-3">
        {last.podium.map((r) => (
          <li key={r.playerId} className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
            <span className={`num text-3xl font-bold ${medal[r.place - 1] ?? ""}`}>{copy.ranking.place(r.place)}</span>
            <Link href={`/players/${r.playerId}`} className="font-semibold hover:underline">
              {name(r.playerId)}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MovementBadge({ movement }: { movement: Movement }) {
  const m = copy.ranking.movement;
  if (movement.kind === "new") return <span className="text-xs font-bold text-gold">{m.new}</span>;
  if (movement.kind === "same")
    return (
      <span className="text-muted" aria-label={m.same}>
        –
      </span>
    );
  const up = movement.kind === "up";
  return (
    <span
      className={`num text-sm font-bold ${up ? "text-board-green" : "text-board-red"}`}
      aria-label={up ? m.up(movement.by) : m.down(movement.by)}
    >
      {up ? "▲" : "▼"}
      {movement.by}
    </span>
  );
}

function RankingTable({ view, players }: { view: RankingView; players: Map<string, PlayerName> }) {
  const c = copy.ranking.columns;
  const th = "px-2 py-2 text-right font-medium whitespace-nowrap";
  const td = "num px-2 text-right text-lg";
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left">
        <thead className="bg-surface text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="w-10 px-2 py-2 text-center font-medium">{c.pos}</th>
            <th className="w-10 px-1 py-2 font-medium">
              <span className="sr-only">{c.move}</span>
            </th>
            <th className="px-2 py-2 font-medium">{c.player}</th>
            <th className={th}>
              <abbr title={c.pointsLong}>{c.points}</abbr>
            </th>
            <th className={`${th} hidden md:table-cell`}>
              <abbr title={c.tournamentsLong}>{c.tournaments}</abbr>
            </th>
            <th className={`${th} hidden sm:table-cell`}>
              <abbr title={c.winsLong}>{c.wins}</abbr>
            </th>
            <th className={`${th} hidden md:table-cell`}>
              <abbr title={c.bestFinishLong}>{c.bestFinish}</abbr>
            </th>
            <th className={th}>
              <abbr title={c.averageLong}>{c.average}</abbr>
            </th>
            <th className={`${th} hidden lg:table-cell`}>{c.t180}</th>
            <th className={`${th} hidden lg:table-cell`}>
              <abbr title={c.highestCheckoutLong}>{c.highestCheckout}</abbr>
            </th>
            <th className={`${th} hidden sm:table-cell`}>{c.elo}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {view.rows.map((r) => {
            const p = players.get(r.playerId);
            return (
              <tr key={r.playerId} className="hover:bg-surface/60">
                <td className="num px-2 py-2 text-center text-xl font-bold">{r.position}</td>
                <td className="px-1 text-center">
                  <MovementBadge movement={r.movement} />
                </td>
                <td className="px-2 py-1">
                  <Link href={`/players/${r.playerId}`} className="flex min-h-11 flex-col justify-center">
                    <span className="font-semibold">{p?.name}</span>
                    {p?.nickname && <span className="text-sm text-muted">“{p.nickname}”</span>}
                  </Link>
                </td>
                <td className={`${td} font-bold text-cream`}>{r.points}</td>
                <td className={`${td} hidden md:table-cell`}>{r.tournaments}</td>
                <td className={`${td} hidden sm:table-cell`}>{r.wins}</td>
                <td className={`${td} hidden md:table-cell`}>{copy.ranking.place(r.bestFinish)}</td>
                <td className={td}>{formatAverage(r.average)}</td>
                <td className={`${td} hidden lg:table-cell`}>{r.t180}</td>
                <td className={`${td} hidden lg:table-cell`}>{r.highestCheckout || "–"}</td>
                <td className={`${td} hidden whitespace-nowrap sm:table-cell`}>
                  {r.elo === null ? "–" : formatElo(r.elo)}
                  {r.eloChange !== null && (
                    <span className={`ml-1 text-sm ${r.eloChange >= 0 ? "text-board-green" : "text-board-red"}`}>
                      {formatEloChange(r.eloChange)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Onboarding() {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="font-display text-2xl font-bold uppercase">{copy.home.emptyTitle}</h2>
      <p className="mt-1 text-muted">{copy.home.emptyIntro}</p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {copy.home.steps.map((step, i) => (
          <li key={step.title} className="flex gap-3 rounded-lg bg-surface-2 p-4">
            <span
              className={`num flex size-9 shrink-0 items-center justify-center rounded-full text-xl font-bold ${
                i % 2 === 0 ? "bg-board-red" : "bg-board-green"
              }`}
            >
              {i + 1}
            </span>
            <div>
              <p className="font-semibold">{step.title}</p>
              <p className="text-sm text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
