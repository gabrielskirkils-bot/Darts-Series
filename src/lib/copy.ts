// All UI strings live here.

import type { RoundName } from "@/lib/domain/bracket";
import type { StructureError } from "@/lib/domain/structure";

export const copy = {
  appName: "Darts Series",
  tagline: "Ranking, tournaments and live scores",

  nav: {
    ranking: "Ranking",
    players: "Players",
    tournaments: "Tournaments",
    settings: "Settings",
    login: "Log in",
  },

  home: {
    title: "Ranking",
    emptyTitle: "No tournaments yet",
    emptyIntro: "Get the series going in three steps:",
    steps: [
      { title: "Add players", body: "Create a profile for everyone who plays." },
      { title: "Create a tournament", body: "Pick the entrants; the structure is suggested for you." },
      { title: "Open a board", body: "Put a phone or tablet at each board and enter scores." },
    ],
    loading: "Loading ranking…",
    loadError: "Couldn't load data. Check the connection and try again.",
    stats: {
      players: "Players",
      tournaments: "Tournaments",
    },
  },

  scoring: {
    impossibleScore: "Impossible score",
    cantCheckout: (remaining: number) => `Can't check out from ${remaining}`,
    bust: "Bust",
    dartsUsed: "Darts used this visit?",
    dartsAtDouble: "Darts at double?",
    undo: "Undo last visit",
    confirmResult: "Confirm result",
  },

  structureErrors: {
    tooFewPlayers: "Select at least 2 players.",
    groupTooSmall: "Each group needs at least 2 players.",
    advanceTooHigh: "Qualifiers per group can't exceed the smallest group.",
    advanceOutOfRange: "Qualifiers per group must be 1–4.",
    knockoutTooSmall: "The knockout needs at least 2 players.",
  } satisfies Record<StructureError, string>,

  roundNames: {
    final: "Final",
    semiFinal: "Semi-final",
    quarterFinal: "Quarter-final",
    last16: "Last 16",
    last32: "Last 32",
    lastN: "Last",
  } satisfies Record<RoundName, string>,

  thirdPlace: "Third-place match",
} as const;

/** "Final", "Semi-final", … "Last 64". */
export function roundLabel(round: { name: RoundName; size: number }): string {
  return round.name === "lastN" ? `${copy.roundNames.lastN} ${round.size}` : copy.roundNames[round.name];
}
