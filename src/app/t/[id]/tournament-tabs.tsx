"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { copy, formatAverage, formatEloChange, formatPercent, matchLabel, roundLabel } from "@/lib/copy";
import { roundName } from "@/lib/domain/bracket";
import type { StandingRow } from "@/lib/domain/groups";
import type { statsTable } from "@/lib/domain/ranking";
import type { Format } from "@/lib/domain/structure";
import type { MatchRow, TournamentOverview, TournamentStatus } from "@/lib/domain/tournament";
import { MatchCard } from "./match-card";

type Tab = "groups" | "bracket" | "matches" | "stats" | "results";

type Shared = {
  tournamentId: string;
  status: TournamentStatus;
  names: Record<string, string>;
  canEdit: boolean;
};

type StatsView = ReturnType<typeof statsTable>;
type ResultRow = { playerId: string; place: number; points: number };

export function TournamentTabs({
  tournamentId,
  format,
  status,
  overview,
  names,
  canEdit,
  stats,
  results,
  eloChanges,
}: Shared & {
  format: Format;
  overview: TournamentOverview;
  stats: StatsView;
  results: ResultRow[];
  eloChanges: Record<string, number>;
}) {
  const tabs: Tab[] = [
    ...(format !== "ko" ? (["groups"] as const) : []),
    ...(format !== "rr" ? (["bracket"] as const) : []),
    "matches",
    "stats",
    "results",
  ];
  const [tab, setTab] = useState<Tab>(
    status === "done" ? "results" : status === "groups" ? tabs[0]! : format === "rr" ? "groups" : "bracket",
  );
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const shared: Shared = { tournamentId, status, names, canEdit };

  function onKey(e: KeyboardEvent) {
    const i = tabs.indexOf(tab);
    const next =
      e.key === "ArrowRight" ? tabs[(i + 1) % tabs.length] : e.key === "ArrowLeft" ? tabs[(i - 1 + tabs.length) % tabs.length] : null;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    refs.current[next]?.focus();
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={copy.tournament.tabsLabel}
        className="-mx-4 flex overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0"
        onKeyDown={onKey}
      >
        {tabs.map((t) => (
          <button
            key={t}
            ref={(el) => {
              refs.current[t] = el;
            }}
            id={`tab-${t}`}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            className={`-mb-px min-h-12 shrink-0 border-b-2 px-3 font-semibold sm:flex-none sm:px-4 ${
              tab === t ? "border-gold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {copy.tournament.tabs[t]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "groups" && <GroupsPanel {...shared} format={format} overview={overview} />}
        {tab === "bracket" && <BracketPanel {...shared} overview={overview} />}
        {tab === "matches" && <MatchesPanel {...shared} overview={overview} />}
        {tab === "stats" && <StatsPanel stats={stats} names={names} />}
        {tab === "results" && <ResultsPanel results={results} names={names} eloChanges={eloChanges} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Stats (for the day) and Results
// ---------------------------------------------------------------

function StatsPanel({ stats, names }: { stats: StatsView; names: Record<string, string> }) {
  if (stats.rows.length === 0) return <p className="text-muted">{copy.tournament.statsEmpty}</p>;
  const c = copy.tournament.statsColumns;
  const name = (id: string) => names[id] ?? copy.tournament.unknownPlayer;
  const leaders = [
    { label: copy.tournament.leaderLabels.average, leader: stats.leaders.average, show: formatAverage },
    { label: copy.tournament.leaderLabels.t180, leader: stats.leaders.t180, show: (v: number) => String(v) },
    { label: copy.tournament.leaderLabels.highestCheckout, leader: stats.leaders.highestCheckout, show: (v: number) => String(v) },
    { label: copy.tournament.leaderLabels.bestLeg, leader: stats.leaders.bestLeg, show: copy.tournament.dartsCount },
  ];
  const th = "px-2 py-2 text-right font-medium whitespace-nowrap";
  const td = "num px-2 text-right text-lg";
  return (
    <div className="space-y-5">
      <section aria-labelledby="leaders-title" className="space-y-2">
        <h2 id="leaders-title" className="font-display text-2xl font-bold uppercase">
          {copy.tournament.leaders}
        </h2>
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {leaders.map(({ label, leader, show }) => (
            <div key={label} className="rounded-lg border border-line bg-surface p-3">
              <dt className="text-sm text-muted">{label}</dt>
              <dd>
                <span className="num block text-3xl font-bold">{leader ? show(leader.value) : "–"}</span>
                <span className="text-sm">{leader ? name(leader.playerId) : ""}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left">
          <thead className="bg-surface text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-2 py-2 font-medium">{c.player}</th>
              <th className={th}>
                <abbr title={c.averageLong}>{c.average}</abbr>
              </th>
              <th className={th}>
                <abbr title={c.first9Long}>{c.first9}</abbr>
              </th>
              <th className={th}>{c.t180}</th>
              <th className={th}>{c.t140}</th>
              <th className={th}>{c.t100}</th>
              <th className={th}>
                <abbr title={c.highestCheckoutLong}>{c.highestCheckout}</abbr>
              </th>
              <th className={th}>
                <abbr title={c.checkoutPercentLong}>{c.checkoutPercent}</abbr>
              </th>
              <th className={th}>
                <abbr title={c.bestLegLong}>{c.bestLeg}</abbr>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {stats.rows.map((r) => (
              <tr key={r.playerId}>
                <td className="px-2 py-2 font-semibold whitespace-nowrap">{name(r.playerId)}</td>
                <td className={td}>{formatAverage(r.average)}</td>
                <td className={td}>{formatAverage(r.first9)}</td>
                <td className={td}>{r.t180}</td>
                <td className={td}>{r.t140}</td>
                <td className={td}>{r.t100}</td>
                <td className={td}>{r.highestCheckout || "–"}</td>
                <td className={td}>{formatPercent(r.checkoutPercent)}</td>
                <td className={td}>{r.bestLeg ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultsPanel({
  results,
  names,
  eloChanges,
}: {
  results: ResultRow[];
  names: Record<string, string>;
  eloChanges: Record<string, number>;
}) {
  if (results.length === 0) return <p className="text-muted">{copy.tournament.resultsPending}</p>;
  const c = copy.tournament.resultsColumns;
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left">
        <thead className="bg-surface text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="px-3 py-2 font-medium">{c.place}</th>
            <th className="px-3 py-2 font-medium">{c.player}</th>
            <th className="px-3 py-2 text-right font-medium">{c.points}</th>
            <th className="px-3 py-2 text-right font-medium">{c.elo}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {results.map((r) => {
            const change = eloChanges[r.playerId];
            return (
              <tr key={r.playerId} className={r.place <= 3 ? "bg-gold/5" : undefined}>
                <td className="num px-3 py-2 text-lg font-bold">{copy.ranking.place(r.place)}</td>
                <td className="px-3 py-2 font-semibold">
                  <Link href={`/players/${r.playerId}`} className="hover:underline">
                    {names[r.playerId] ?? copy.tournament.unknownPlayer}
                  </Link>
                </td>
                <td className="num px-3 text-right text-lg">{r.points}</td>
                <td
                  className={`num px-3 text-right text-lg ${
                    change === undefined ? "text-muted" : change >= 0 ? "text-win" : "text-alert"
                  }`}
                >
                  {change === undefined ? "–" : formatEloChange(change)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------
// Groups
// ---------------------------------------------------------------

function GroupsPanel({ format, overview, ...shared }: Shared & { format: Format; overview: TournamentOverview }) {
  const all = [...overview.buckets.live, ...overview.buckets.waiting, ...overview.buckets.finished].filter(
    (m) => m.stage === "group",
  );
  return (
    <div className="space-y-6">
      {overview.qualifiers > 0 && <p className="text-sm text-muted">{copy.tournament.qualifyLegend(overview.qualifiers)}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        {overview.tables.map((rows, g) => {
          const title = format === "rr" ? copy.tournament.standings : copy.tournament.groupName(g);
          const matches = all.filter((m) => m.groupIndex === g).sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <section key={g} className="space-y-3" aria-labelledby={`group-${g}`}>
              <h2 id={`group-${g}`} className="font-display text-2xl font-bold uppercase">
                {title}
              </h2>
              <GroupTable rows={rows} names={shared.names} qualifiers={overview.qualifiers} />
              <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">{copy.tournament.groupMatches}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {matches.map((m) => (
                  <li key={m.id}>
                    <MatchCard match={m} label={copy.tournament.roundShort(m.round)} compact {...shared} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function GroupTable({
  rows,
  names,
  qualifiers,
}: {
  rows: StandingRow[];
  names: Record<string, string>;
  qualifiers: number;
}) {
  const t = copy.tournament.table;
  const th = "px-2 py-2 text-right font-medium";
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left">
        <thead className="bg-surface text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="w-8 px-2 py-2 text-center font-medium">{t.pos}</th>
            <th className="px-2 py-2 font-medium">{t.player}</th>
            <th className={th}>
              <abbr title={t.playedLong}>{t.played}</abbr>
            </th>
            <th className={th}>
              <abbr title={t.winsLong}>{t.wins}</abbr>
            </th>
            <th className={th}>
              <abbr title={t.lossesLong}>{t.losses}</abbr>
            </th>
            <th className={`${th} hidden sm:table-cell`}>{t.legs}</th>
            <th className={th}>
              <abbr title={t.diffLong}>{t.diff}</abbr>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const q = r.position <= qualifiers;
            return (
              <tr key={r.playerId} className={q ? "bg-win/10" : undefined}>
                <td
                  className={`num border-l-4 px-2 py-2 text-center text-lg ${q ? "border-win" : "border-transparent"}`}
                >
                  {r.position}
                  {q && <span className="sr-only"> ({copy.tournament.qualifies})</span>}
                </td>
                <td className="px-2 py-2 font-semibold">{names[r.playerId] ?? copy.tournament.unknownPlayer}</td>
                <td className="num px-2 text-right text-lg">{r.played}</td>
                <td className="num px-2 text-right text-lg">{r.wins}</td>
                <td className="num px-2 text-right text-lg">{r.losses}</td>
                <td className="num hidden px-2 text-right text-lg sm:table-cell">
                  {r.legsWon}–{r.legsLost}
                </td>
                <td className="num px-2 text-right text-lg">{r.legDiff > 0 ? `+${r.legDiff}` : r.legDiff}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------
// Bracket
// ---------------------------------------------------------------

function BracketPanel({ overview, ...shared }: Shared & { overview: TournamentOverview }) {
  const { columns, third } = overview.bracket;
  if (columns.length === 0) return <p className="text-muted">{copy.tournament.bracketPending}</p>;
  const rounds = columns.length;
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <div className="flex min-w-max gap-4">
        {columns.map((matches, i) => (
          <section key={i} className="flex w-60 flex-col" aria-labelledby={`round-${i}`}>
            <h2 id={`round-${i}`} className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">
              {roundLabel(roundName(i + 1, rounds))}
            </h2>
            <ul className="flex flex-1 flex-col justify-around gap-3">
              {matches.map((m) => (
                <li key={m.id}>
                  <MatchCard match={m} label={null} compact {...shared} />
                </li>
              ))}
              {i === rounds - 1 && third && (
                <li>
                  <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{copy.thirdPlace}</h3>
                  <MatchCard match={third} label={null} compact {...shared} />
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Matches
// ---------------------------------------------------------------

function MatchesPanel({ overview, ...shared }: Shared & { overview: TournamentOverview }) {
  const { live, waiting, finished } = overview.buckets;
  return (
    <div className="space-y-6">
      <MatchList title={copy.tournament.lists.live} empty={copy.tournament.noLive} matches={live} rounds={overview.rounds} shared={shared} />
      <MatchList
        title={copy.tournament.lists.waiting}
        empty={copy.tournament.noWaiting}
        matches={waiting}
        rounds={overview.rounds}
        shared={shared}
      />
      <MatchList
        title={copy.tournament.lists.finished}
        empty={copy.tournament.noFinished}
        matches={finished}
        rounds={overview.rounds}
        shared={shared}
      />
    </div>
  );
}

function MatchList({
  title,
  empty,
  matches,
  rounds,
  shared,
}: {
  title: string;
  empty: string;
  matches: MatchRow[];
  rounds: number;
  shared: Shared;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-2xl font-bold uppercase">
        {title} <span className="num text-muted">({matches.length})</span>
      </h2>
      {matches.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((m) => (
            <li key={m.id}>
              <MatchCard match={m} label={matchLabel(m, rounds)} {...shared} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
