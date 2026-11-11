"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMatchSync } from "@/components/scoreboard/use-match-sync";
import { Crest } from "@/components/crest";
import { StatusBadge } from "@/components/status-badge";
import { copy, formatAverage, roundLabel } from "@/lib/copy";
import { roundName } from "@/lib/domain/bracket";
import { suggestCheckout } from "@/lib/domain/checkout";
import type { StandingRow } from "@/lib/domain/groups";
import { lastVisit, matchState, matchSummary } from "@/lib/domain/match";
import type { Leader } from "@/lib/domain/ranking";
import type { MatchRow, TournamentStatus } from "@/lib/domain/tournament";
import type { MatchVisits } from "@/lib/supabase/visits";

export type TvBoard = {
  board: number;
  live: {
    id: string;
    label: string;
    players: [string, string];
    startScore: number;
    bestOf: number;
    initial: MatchVisits;
  } | null;
  next: { label: string; players: [string, string] } | null;
};

type Slide = "groups" | "bracket" | "leaders" | "ranking";

const SLIDE_MS = 12_000;

export function TvScreen({
  name,
  status,
  progress,
  winner,
  names,
  boards,
  tables,
  isRoundRobin,
  qualifiers,
  bracket,
  rounds,
  leaders,
  ranking,
  latest,
}: {
  name: string;
  status: TournamentStatus;
  progress: { done: number; total: number };
  winner: string | null;
  names: Record<string, string>;
  boards: TvBoard[];
  tables: StandingRow[][];
  isRoundRobin: boolean;
  qualifiers: number;
  bracket: { columns: MatchRow[][]; third: MatchRow | null };
  rounds: number;
  leaders: { average: Leader; t180: Leader; highestCheckout: Leader; bestLeg: Leader };
  ranking: { playerId: string; name: string; position: number; points: number; average: number | null }[];
  latest: {
    id: string;
    label: string;
    p1: string;
    p2: string;
    legsP1: number;
    legsP2: number;
    winnerSide: number;
  }[];
}) {
  const slides = useMemo(() => {
    const list: Slide[] = [];
    if (tables.length > 0) list.push("groups");
    if (bracket.columns.length > 0) list.push("bracket");
    if (leaders.average || leaders.t180 || leaders.highestCheckout || leaders.bestLeg) list.push("leaders");
    if (ranking.length > 0) list.push("ranking");
    return list;
  }, [tables.length, bracket.columns.length, leaders, ranking.length]);

  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, [slides.length]);
  const slide = slides[index % Math.max(1, slides.length)];
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-[1.2vh] p-[1.5vw]">
      <header className="flex items-center justify-between gap-[2vw]">
        <div className="flex min-w-0 items-center gap-[1.2vw]">
          <Crest height={120} sizeClass="h-[8vh] w-auto" priority />
          <div className="min-w-0">
            <p className="text-[0.9vw] font-semibold tracking-[0.25em] text-gold uppercase">{copy.fullName}</p>
            <div className="flex min-w-0 items-center gap-[1vw]">
              <h1 className="font-display truncate text-[2.6vw] leading-none tracking-wide uppercase">{name}</h1>
              <StatusBadge status={status} />
              {winner && (
                <span className="text-[1.6vw] font-semibold text-gold">{copy.tv.winner(names[winner] ?? "")}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex w-[22vw] shrink-0 items-center gap-[0.8vw]">
          <div className="h-[0.8vh] flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
          </div>
          <span className="num text-[1.3vw] text-muted">
            {progress.done}/{progress.total}
          </span>
        </div>
      </header>

      <main className="grid min-h-0 grid-cols-[3fr_2fr] gap-[1.5vw]">
        <section
          className="grid min-h-0 gap-[1.2vh]"
          style={{ gridTemplateRows: `repeat(${boards.length}, minmax(0, 1fr))` }}
        >
          {boards.map((b) =>
            b.live ? (
              <LiveBoard key={b.live.id} board={b.board} live={b.live} count={boards.length} />
            ) : (
              <FreeBoard key={`free-${b.board}`} board={b.board} next={b.next} />
            ),
          )}
        </section>

        <section className="flex min-h-0 flex-col rounded-[1vw] border border-line bg-surface p-[1.2vw]">
          {slide ? (
            <>
              <div className="mb-[1vh] flex items-center justify-between">
                <h2 className="text-[1.4vw] font-semibold tracking-wide text-muted uppercase">{copy.tv.slides[slide]}</h2>
                {slides.length > 1 && (
                  <span className="num text-[1.1vw] text-muted">{copy.tv.slideOf(index + 1, slides.length)}</span>
                )}
              </div>
              {slides.length > 1 && (
                <div className="mb-[1.2vh] h-[0.5vh] overflow-hidden rounded-full bg-surface-2">
                  <div
                    key={index}
                    className="tv-progress h-full bg-gold"
                    style={{ "--tv-slide-ms": `${SLIDE_MS}ms` } as CSSProperties}
                  />
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-hidden">
                {slide === "groups" && (
                  <GroupsSlide tables={tables} names={names} qualifiers={qualifiers} isRoundRobin={isRoundRobin} />
                )}
                {slide === "bracket" && <BracketSlide bracket={bracket} rounds={rounds} names={names} />}
                {slide === "leaders" && <LeadersSlide leaders={leaders} names={names} />}
                {slide === "ranking" && <RankingSlide ranking={ranking} />}
              </div>
            </>
          ) : (
            <p className="text-[1.4vw] text-muted">{copy.tv.noResults}</p>
          )}
        </section>
      </main>

      <footer className="flex min-w-0 items-center gap-[1.2vw] overflow-hidden">
        <span className="shrink-0 text-[1.2vw] font-semibold tracking-wide text-muted uppercase">{copy.tv.latest}</span>
        {latest.length === 0 ? (
          <span className="text-[1.2vw] text-muted">{copy.tv.noResults}</span>
        ) : (
          <ul className="flex min-w-0 gap-[1.2vw] overflow-hidden">
            {latest.map((r) => (
              <li key={r.id} className="shrink-0 rounded-[0.6vw] bg-surface px-[0.9vw] py-[0.5vh] text-[1.2vw]">
                <span className="text-muted">{r.label} · </span>
                <span className={r.winnerSide === 0 ? "font-bold" : ""}>{r.p1}</span>{" "}
                <span className="num font-bold text-gold">
                  {r.legsP1}–{r.legsP2}
                </span>{" "}
                <span className={r.winnerSide === 1 ? "font-bold" : ""}>{r.p2}</span>
              </li>
            ))}
          </ul>
        )}
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------
// Boards
// ---------------------------------------------------------------

function LiveBoard({ board, live, count }: { board: number; live: NonNullable<TvBoard["live"]>; count: number }) {
  const { visits } = useMatchSync(live.id, live.initial.visits);
  const setup = useMemo(
    () => ({ startScore: live.startScore, bestOf: live.bestOf, firstStarter: live.initial.firstStarter }),
    [live.startScore, live.bestOf, live.initial.firstStarter],
  );
  const state = useMemo(() => matchState(setup, visits), [setup, visits]);
  const summary = useMemo(() => matchSummary(visits), [visits]);
  const last = lastVisit(visits);
  // Remaining scores scale with the number of boards so all fit on one 16:9 screen.
  const big: CSSProperties = { fontSize: `min(6.5vw, ${30 / count}vh)` };

  return (
    <article className="flex min-h-0 flex-col rounded-[1vw] border border-line bg-surface p-[1vw]">
      <div className="flex items-baseline justify-between text-[1.2vw] text-muted">
        <span className="font-semibold tracking-wide uppercase">{copy.tv.board(board)}</span>
        <span>{live.label}</span>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-2 gap-[0.6vh]">
        {([0, 1] as const).map((side) => {
          const active = state.winner === null && state.toThrow === side;
          const remaining = state.remaining[side];
          const route = active && remaining <= 170 ? suggestCheckout(remaining) : null;
          const mine = last && last.player === side ? last : null;
          return (
            <div
              key={side}
              className={`flex min-h-0 items-center gap-[1.2vw] rounded-[0.7vw] border-l-[0.5vw] px-[1vw] ${
                active ? "border-gold bg-surface-2" : "border-transparent"
              } ${state.winner === side ? "text-win" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[2vw] leading-tight font-semibold">{live.players[side]}</p>
                <p className="text-[1.1vw] text-muted">
                  {copy.tv.average} <span className="num text-ink">{formatAverage(summary[side].average)}</span>
                  {mine && (
                    <>
                      {" · "}
                      {copy.tv.lastVisit}{" "}
                      <span className={`num ${mine.bust ? "text-alert" : "text-ink"}`}>
                        {mine.bust ? copy.scoring.bustEntry(mine.score) : mine.score}
                      </span>
                    </>
                  )}
                  {route && <span className="num ml-[0.6vw] text-win">{route.join(" ")}</span>}
                </p>
              </div>
              <span className="num rounded-[0.5vw] bg-bg px-[0.8vw] text-[2.6vw] font-bold" aria-label={`${copy.tv.legs} ${state.legsWon[side]}`}>
                {state.legsWon[side]}
              </span>
              <span className="num w-[11vw] text-right leading-none font-bold" style={big}>
                {remaining}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function FreeBoard({ board, next }: { board: number; next: TvBoard["next"] }) {
  return (
    <article className="relative flex min-h-0 flex-col justify-center overflow-hidden rounded-[1vw] border border-dashed border-line p-[1vw]">
      <Crest
        height={300}
        sizeClass="h-[130%] w-auto"
        className="pointer-events-none absolute top-1/2 right-[3%] -translate-y-1/2 opacity-[0.08]"
        decorative
      />
      <p className="relative text-[1.2vw] font-semibold tracking-wide text-muted uppercase">
        {copy.tv.board(board)} · {copy.tv.free}
      </p>
      {next && (
        <p className="relative mt-[0.6vh] truncate text-[2vw]">
          <span className="text-muted">{copy.tv.next}: </span>
          <span className="font-semibold">{next.players[0]}</span>
          <span className="text-muted"> {copy.tv.versus} </span>
          <span className="font-semibold">{next.players[1]}</span>
          <span className="ml-[0.8vw] text-[1.2vw] text-muted">{next.label}</span>
        </p>
      )}
    </article>
  );
}

// ---------------------------------------------------------------
// Rotating panel
// ---------------------------------------------------------------

function GroupsSlide({
  tables,
  names,
  qualifiers,
  isRoundRobin,
}: {
  tables: StandingRow[][];
  names: Record<string, string>;
  qualifiers: number;
  isRoundRobin: boolean;
}) {
  const cols = tables.length === 1 ? 1 : 2;
  const t = copy.tournament.table;
  return (
    <div className="grid h-full content-start gap-[1vw]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {tables.map((rows, g) => (
        <div key={g}>
          <p className="mb-[0.4vh] text-[1.2vw] font-semibold">
            {isRoundRobin ? copy.tournament.standings : copy.tournament.groupName(g)}
          </p>
          <table className="w-full text-[1.1vw]">
            <thead className="text-muted">
              <tr>
                <th className="w-[2vw] text-left font-medium">{t.pos}</th>
                <th className="text-left font-medium">{t.player}</th>
                <th className="text-right font-medium">{t.wins}</th>
                <th className="text-right font-medium">{t.diff}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.playerId} className={r.position <= qualifiers ? "text-ink" : "text-muted"}>
                  <td className={`num ${r.position <= qualifiers ? "text-win" : ""}`}>{r.position}</td>
                  <td className="truncate">{names[r.playerId]}</td>
                  <td className="num text-right">{r.wins}</td>
                  <td className="num text-right">{r.legDiff > 0 ? `+${r.legDiff}` : r.legDiff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function BracketSlide({
  bracket,
  rounds,
  names,
}: {
  bracket: { columns: MatchRow[][]; third: MatchRow | null };
  rounds: number;
  names: Record<string, string>;
}) {
  const player = (m: MatchRow, id: string | null) => (id ? names[id] : m.isBye ? copy.tournament.bye : copy.tournament.tbd);
  return (
    <div className="flex h-full gap-[0.8vw]">
      {bracket.columns.map((matches, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col">
          <p className="mb-[0.4vh] truncate text-[1vw] text-muted uppercase">{roundLabel(roundName(i + 1, rounds))}</p>
          <div className="flex flex-1 flex-col justify-around gap-[0.5vh]">
            {[...matches, ...(i === rounds - 1 && bracket.third ? [bracket.third] : [])].map((m) => (
              <div key={m.id} className="rounded-[0.5vw] bg-surface-2 px-[0.6vw] py-[0.4vh] text-[1vw]">
                {([0, 1] as const).map((side) => {
                  const id = side === 0 ? m.p1 : m.p2;
                  const won = m.status === "done" && !m.isBye && m.winnerId !== null && m.winnerId === id;
                  return (
                    <p key={side} className={`flex justify-between gap-[0.4vw] ${won ? "font-bold" : "text-muted"}`}>
                      <span className="truncate">{player(m, id)}</span>
                      {(m.status === "done" || m.status === "live") && !m.isBye && (
                        <span className="num">{side === 0 ? m.legsP1 : m.legsP2}</span>
                      )}
                    </p>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LeadersSlide({
  leaders,
  names,
}: {
  leaders: { average: Leader; t180: Leader; highestCheckout: Leader; bestLeg: Leader };
  names: Record<string, string>;
}) {
  const l = copy.tournament.leaderLabels;
  const items = [
    { label: l.average, leader: leaders.average, show: formatAverage },
    { label: l.t180, leader: leaders.t180, show: String },
    { label: l.highestCheckout, leader: leaders.highestCheckout, show: String },
    { label: l.bestLeg, leader: leaders.bestLeg, show: copy.tournament.dartsCount },
  ];
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-[1vw]">
      {items.map(({ label, leader, show }) => (
        <div key={label} className="flex flex-col justify-center rounded-[0.8vw] bg-surface-2 p-[1vw]">
          <p className="text-[1.2vw] text-muted">{label}</p>
          <p className="num text-[4vw] leading-none font-bold">{leader ? show(leader.value) : "–"}</p>
          <p className="truncate text-[1.5vw]">{leader ? names[leader.playerId] : ""}</p>
        </div>
      ))}
    </div>
  );
}

function RankingSlide({
  ranking,
}: {
  ranking: { playerId: string; name: string; position: number; points: number; average: number | null }[];
}) {
  const c = copy.ranking.columns;
  return (
    <table className="w-full text-[1.4vw]">
      <thead className="text-[1vw] text-muted uppercase">
        <tr>
          <th className="w-[3vw] text-left font-medium">{c.pos}</th>
          <th className="text-left font-medium">{c.player}</th>
          <th className="text-right font-medium">{c.points}</th>
          <th className="text-right font-medium">{c.average}</th>
        </tr>
      </thead>
      <tbody>
        {ranking.map((r) => (
          <tr key={r.playerId} className="border-t border-line">
            <td className="num py-[0.3vh] font-bold">{r.position}</td>
            <td className="truncate">{r.name}</td>
            <td className="num text-right font-bold">{r.points}</td>
            <td className="num text-right text-muted">{formatAverage(r.average)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
