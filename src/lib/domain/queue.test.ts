import { describe, expect, it } from "vitest";
import {
  boardAssignments,
  knockoutSortOrder,
  liveOnBoard,
  nextMatch,
  waitingMatches,
  type QueueMatch,
} from "./queue";

const m = (id: string, p1: string | null, p2: string | null, sortOrder: number, extra: Partial<QueueMatch> = {}): QueueMatch => ({
  id,
  p1,
  p2,
  sortOrder,
  status: "pending",
  isBye: false,
  board: null,
  ...extra,
});

describe("boardAssignments (TV)", () => {
  it("live boards show their match; free boards get distinct next matches with free players", () => {
    const matches = [
      m("live", "a", "b", 0, { status: "live", board: 2 }),
      m("m1", "a", "c", 1), // a busy
      m("m2", "d", "e", 2),
      m("m3", "d", "f", 3), // d would be busy after m2 goes to board 1
      m("m4", "g", "h", 4),
    ];
    const result = boardAssignments(matches, 3);
    expect(result.map((r) => [r.board, r.live?.id ?? null, r.next?.id ?? null])).toEqual([
      [1, null, "m2"],
      [2, "live", null],
      [3, null, "m4"],
    ]);
  });

  it("nothing to play leaves free boards empty", () => {
    expect(boardAssignments([m("done", "a", "b", 0, { status: "done" })], 2)).toEqual([
      { board: 1, live: null, next: null },
      { board: 2, live: null, next: null },
    ]);
  });
});

describe("board queue", () => {
  it("next match = lowest sort_order with both players free", () => {
    const matches = [
      m("live", "a", "b", 0, { status: "live", board: 1 }),
      m("m1", "a", "c", 1), // a is busy
      m("m2", "d", "e", 2),
      m("m3", "f", "g", 3),
    ];
    expect(nextMatch(matches)?.id).toBe("m2");
  });

  it("skips byes, finished matches and matches waiting for a player", () => {
    const matches = [
      m("bye", "a", null, 0, { isBye: true, status: "done" }),
      m("tbd", "b", null, 1),
      m("done", "c", "d", 2, { status: "done" }),
      m("ok", "e", "f", 3),
    ];
    expect(waitingMatches(matches).map((x) => x.id)).toEqual(["ok"]);
    expect(nextMatch(matches)?.id).toBe("ok");
  });

  it("returns null when nothing is playable", () => {
    expect(nextMatch([m("live", "a", "b", 0, { status: "live", board: 1 }), m("m1", "a", "b", 1)])).toBeNull();
    expect(nextMatch([])).toBeNull();
  });

  it("finds the live match on a board", () => {
    const matches = [m("x", "a", "b", 0, { status: "live", board: 2 })];
    expect(liveOnBoard(matches, 2)?.id).toBe("x");
    expect(liveOnBoard(matches, 1)).toBeNull();
  });
});

describe("knockoutSortOrder", () => {
  it("knockout after groups, by round then slot, third place right before the final", () => {
    const qf = knockoutSortOrder("ko", 1, 3, 3);
    const sf = knockoutSortOrder("ko", 2, 0, 3);
    const third = knockoutSortOrder("third", 3, 0, 3);
    const final = knockoutSortOrder("ko", 3, 0, 3);
    expect(qf).toBeGreaterThan(5000);
    expect(qf).toBeLessThan(sf);
    expect(sf).toBeLessThan(third);
    expect(third).toBeLessThan(final);
  });
});
