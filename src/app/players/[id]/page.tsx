import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { LineChart } from "@/components/line-chart";
import { PeriodPicker, periodFromParam } from "@/components/period-picker";
import { alertError, card } from "@/components/ui";
import { copy, formatAverage, formatElo, formatEloChange, formatPercent } from "@/lib/copy";
import { playerProfile, rankingYears, type PlayerProfile } from "@/lib/domain/ranking";
import { getViewer } from "@/lib/supabase/auth";
import { getPlayer, listPlayers } from "@/lib/supabase/queries";
import { getPlayerMatches, getRankingData } from "@/lib/supabase/ranking";
import { formatDate } from "@/lib/time";
import { EditPlayerForm } from "../player-form";
import { PlayerAdminActions } from "./player-admin";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: PageProps<"/players/[id]">): Promise<Metadata> {
  const { id } = await params;
  const player = UUID_RE.test(id) ? await getPlayer(id).catch(() => null) : null;
  return player ? { title: player.name } : {};
}

export default function PlayerPage({ params, searchParams }: PageProps<"/players/[id]">) {
  return (
    <div className="space-y-5">
      <Link href="/players" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">
        ← {copy.players.back}
      </Link>
      <Suspense fallback={<p className="text-muted">{copy.common.loading}</p>}>
        <PlayerContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PlayerContent({
  params,
  searchParams,
}: {
  params: PageProps<"/players/[id]">["params"];
  searchParams: PageProps<"/players/[id]">["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(id)) notFound();

  const data = await Promise.all([getPlayer(id), getViewer(), getRankingData(), getPlayerMatches(id)]).catch(
    () => null,
  );
  if (!data) return <p className={alertError}>{copy.common.loadError}</p>;
  const [player, viewer, ranking, matches] = data;
  if (!player) notFound();
  const canEdit = viewer?.isOrganizer ?? false;
  const allPlayers = canEdit ? await listPlayers().catch(() => []) : [];

  const years = rankingYears(ranking.tournaments);
  const period = periodFromParam(query.year, years);
  const profile = playerProfile({ ...ranking, playerId: id, matches }, period);
  const name = (pid: string) => ranking.players.get(pid)?.name ?? copy.tournament.unknownPlayer;
  const hasResults = profile.history.length > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide uppercase">
          {player.name}
          {!player.active && (
            <span className="ml-3 align-middle rounded bg-surface-2 px-2 py-1 text-sm font-medium text-muted normal-case">
              {copy.players.archived}
            </span>
          )}
        </h1>
        {player.nickname && <p className="text-lg text-muted">“{player.nickname}”</p>}
      </header>

      <dl className="grid grid-cols-3 gap-3 sm:max-w-xl">
        <Tile
          label={copy.profile.position}
          value={profile.ranking ? copy.profile.positionValue(profile.ranking.position) : "–"}
        />
        <Tile label={copy.profile.points} value={profile.ranking?.points ?? 0} />
        <Tile
          label={copy.profile.elo}
          value={formatElo(profile.elo ?? player.elo)}
          extra={
            profile.eloChange !== null ? (
              <span
                className={`num text-lg ${profile.eloChange >= 0 ? "text-win" : "text-alert"}`}
                title={copy.profile.eloChangeHint}
              >
                {formatEloChange(profile.eloChange)}
              </span>
            ) : undefined
          }
        />
      </dl>

      {!hasResults && <p className="text-muted">{copy.players.profileEmpty}</p>}

      {hasResults && (
        <>
          {years.length > 1 && <PeriodPicker basePath={`/players/${id}`} years={years} period={period} />}
          <StatTiles profile={profile} />
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartOrNote
              title={copy.profile.eloChart}
              points={profile.eloSeries.map((p) => ({
                label: p.label ? formatDate(p.date) : copy.profile.chartStart,
                value: p.rating,
              }))}
              kind="elo"
            />
            <ChartOrNote
              title={copy.profile.averageChart}
              points={profile.averageSeries.map((p) => ({ label: formatDate(p.date), value: p.average }))}
              kind="average"
            />
          </div>
          <History profile={profile} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Recent profile={profile} name={name} />
            <HeadToHead profile={profile} name={name} />
          </div>
        </>
      )}

      {canEdit && (
        <section className={`${card} space-y-4`}>
          <h2 className="font-display text-xl font-bold uppercase">{copy.players.editTitle}</h2>
          <EditPlayerForm player={player} players={allPlayers} />
          <PlayerAdminActions id={player.id} active={player.active} canDelete={!player.hasEntries} />
        </section>
      )}
    </div>
  );
}

function Tile({ label, value, extra }: { label: string; value: string | number; extra?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3 sm:p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-2">
        <span className="num text-3xl font-bold sm:text-4xl">{value}</span>
        {extra}
      </dd>
    </div>
  );
}

function StatTiles({ profile }: { profile: PlayerProfile }) {
  const t = profile.tiles;
  const l = copy.profile.tiles;
  const tiles: [string, string][] = [
    [l.average, formatAverage(t.average)],
    [l.first9, formatAverage(t.first9)],
    [l.t180, String(t.t180)],
    [l.t140, String(t.t140)],
    [l.t100, String(t.t100)],
    [l.highestCheckout, t.highestCheckout ? String(t.highestCheckout) : "–"],
    [l.checkoutPercent, formatPercent(t.checkoutPercent)],
    [l.bestLeg, t.bestLeg === null ? "–" : copy.profile.bestLegValue(t.bestLeg)],
    [l.matches, copy.profile.winLoss(t.record.matches.won, t.record.matches.lost)],
    [l.legs, copy.profile.winLoss(t.record.legs.won, t.record.legs.lost)],
    [l.wins, String(t.wins)],
    [l.bestFinish, t.bestFinish === null ? "–" : copy.ranking.place(t.bestFinish)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-line bg-surface p-3">
          <dt className="text-xs text-muted sm:text-sm">{label}</dt>
          <dd className="num text-2xl font-bold sm:text-3xl">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChartOrNote({
  title,
  points,
  kind,
}: {
  title: string;
  points: { label: string; value: number }[];
  kind: "elo" | "average";
}) {
  if (points.length < 2) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold tracking-wide text-muted uppercase">{title}</p>
        <p className="mt-2 text-sm text-muted">{copy.profile.chartTooFew}</p>
      </div>
    );
  }
  return <LineChart title={title} points={points} kind={kind} />;
}

function History({ profile }: { profile: PlayerProfile }) {
  const c = copy.profile.historyColumns;
  const th = "px-2 py-2 text-right font-medium";
  return (
    <section aria-labelledby="history-title" className="space-y-2">
      <h2 id="history-title" className="font-display text-2xl font-bold uppercase">
        {copy.profile.history}
      </h2>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left">
          <thead className="bg-surface text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-2 py-2 font-medium">{c.date}</th>
              <th className="px-2 py-2 font-medium">{c.tournament}</th>
              <th className={th}>{c.place}</th>
              <th className={th}>{c.points}</th>
              <th className={th}>{c.average}</th>
              <th className={`${th} hidden sm:table-cell`}>{c.t180}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {profile.history.map((h) => (
              <tr key={h.tournament.id}>
                <td className="num px-2 py-2 whitespace-nowrap text-muted">{formatDate(h.tournament.date)}</td>
                <td className="px-2 py-2">
                  <Link href={`/t/${h.tournament.id}`} className="font-semibold hover:underline">
                    {h.tournament.name}
                  </Link>
                </td>
                <td className="num px-2 text-right text-lg font-bold">{copy.ranking.place(h.place)}</td>
                <td className="num px-2 text-right text-lg">{h.points}</td>
                <td className="num px-2 text-right text-lg">{formatAverage(h.average)}</td>
                <td className="num hidden px-2 text-right text-lg sm:table-cell">{h.t180}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Recent({ profile, name }: { profile: PlayerProfile; name: (id: string) => string }) {
  return (
    <section aria-labelledby="recent-title" className="space-y-2">
      <h2 id="recent-title" className="font-display text-2xl font-bold uppercase">
        {copy.profile.recent}
      </h2>
      {profile.recent.length === 0 ? (
        <p className="text-muted">{copy.profile.none}</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {profile.recent.map((m) => {
            const mine = m.p1 === m.opponentId ? m.legsP2 : m.legsP1;
            const theirs = m.p1 === m.opponentId ? m.legsP1 : m.legsP2;
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="text-muted">v </span>
                    <Link href={`/players/${m.opponentId}`} className="font-semibold hover:underline">
                      {name(m.opponentId)}
                    </Link>
                  </p>
                  <p className="truncate text-xs text-muted">
                    {formatDate(m.tournament.date)} · {m.tournament.name} · {copy.profile.stage[m.stage]}
                    {m.isManual && ` · ${copy.profile.manual}`}
                  </p>
                </div>
                <span
                  className={`num shrink-0 rounded-md px-2 py-0.5 text-lg font-bold ${
                    m.won ? "bg-win/20 text-win" : "bg-brand-red/15 text-alert"
                  }`}
                  aria-label={`${m.won ? copy.profile.won : copy.profile.lost} ${mine}–${theirs}`}
                >
                  {mine}–{theirs}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function HeadToHead({ profile, name }: { profile: PlayerProfile; name: (id: string) => string }) {
  const c = copy.profile.h2hColumns;
  return (
    <section aria-labelledby="h2h-title" className="space-y-2">
      <h2 id="h2h-title" className="font-display text-2xl font-bold uppercase">
        {copy.profile.headToHead}
      </h2>
      {profile.headToHead.length === 0 ? (
        <p className="text-muted">{copy.profile.none}</p>
      ) : (
        <table className="w-full overflow-hidden rounded-xl border border-line text-left">
          <thead className="bg-surface text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">{c.opponent}</th>
              <th className="px-3 py-2 text-right font-medium">{c.record}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {profile.headToHead.map((h) => (
              <tr key={h.opponentId}>
                <td className="px-3 py-2">
                  <Link href={`/players/${h.opponentId}`} className="font-semibold hover:underline">
                    {name(h.opponentId)}
                  </Link>
                </td>
                <td className="num px-3 text-right text-lg">{copy.profile.winLoss(h.won, h.lost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
