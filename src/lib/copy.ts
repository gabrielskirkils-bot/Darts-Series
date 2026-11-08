// All UI strings live here.

import type { RoundName } from "@/lib/domain/bracket";
import type { PlayerInputError, PlayerSortKey } from "@/lib/domain/players";
import type { SettingsError } from "@/lib/domain/settings";
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
    logout: "Log out",
    readOnly: "Read-only",
    menu: "Menu",
  },

  common: {
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    cancel: "Cancel",
    edit: "Edit",
    loading: "Loading…",
    loadError: "Couldn't load data. Check the connection and try again.",
    notAllowed: "Only organizers can do this. Log in with an organizer account.",
    genericError: "Something went wrong. Try again.",
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

  login: {
    title: "Organizer login",
    intro: "Spectators don't need an account. Organizers log in with a link sent by email.",
    emailLabel: "Email",
    submit: "Send login link",
    sending: "Sending…",
    sentTitle: "Check your email",
    sentBody: (email: string) => `We sent a login link to ${email}. Open it on this device.`,
    useAnother: "Use a different email",
    invalidEmail: "Enter a valid email address.",
    rateLimited: "Too many login emails. Wait a few minutes and try again.",
    failed: "Couldn't send the login link. Try again.",
    linkExpired: "That login link is invalid or has expired. Request a new one.",
    loggedInAs: (email: string) => `You're logged in as ${email}.`,
    organizer: "You're an organizer and can enter scores and edit data.",
    notOrganizer:
      "Your account isn't an organizer yet, so the app is read-only for you. Ask an organizer to add you.",
  },

  players: {
    title: "Players",
    searchLabel: "Search players",
    searchPlaceholder: "Search by name or nickname",
    sortLabel: "Sort by",
    sort: {
      name: "Name",
      elo: "Elo",
      points: "Points",
      tournaments: "Tournaments",
    } satisfies Record<PlayerSortKey, string>,
    showArchived: "Show archived",
    count: (shown: number, total: number) => {
      const noun = total === 1 ? "player" : "players";
      return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`;
    },
    columns: { player: "Player", elo: "Elo", points: "Points", tournaments: "Played" },
    empty: "No players yet.",
    emptyOrganizer: "No players yet. Add the first one above.",
    noMatches: "No players match your search.",
    allArchived: "All players are archived. Tick “Show archived” to see them.",
    archived: "Archived",
    add: "Add player",
    addTitle: "New player",
    name: "Name",
    nickname: "Nickname",
    optional: "optional",
    added: (name: string) => `Added ${name}.`,
    duplicateWarning: (name: string) => `There's already a player called “${name}”.`,
    duplicateError: "A player with this name already exists.",
    inputErrors: {
      nameRequired: "Enter a name.",
      nameTooLong: "Name is too long (max 60 characters).",
      nicknameTooLong: "Nickname is too long (max 30 characters).",
    } satisfies Record<PlayerInputError, string>,
    editTitle: "Edit player",
    archive: "Archive",
    restore: "Restore",
    archivedNote: "Archived players are hidden from the player list and tournament wizard. Their results stay.",
    delete: "Delete player",
    confirmDelete: "Delete permanently",
    deleteHint: "Only possible for players who never entered a tournament.",
    cannotDelete: "This player has entered a tournament, so they can't be deleted. Archive them instead.",
    notFound: "Player not found.",
    back: "All players",
    stats: { elo: "Elo", points: "Points", tournaments: "Tournaments" },
    profileEmpty: "Stats appear here once this player has finished a tournament.",
  },

  settings: {
    title: "Settings",
    loginNeeded: "Settings are for organizers. Log in with an organizer account.",
    points: {
      title: "Points table",
      intro: "Each row gives points from that place downwards, until the next row.",
      from: "From place",
      pts: "Points",
      add: "Add row",
      remove: "Remove row",
    },
    elo: {
      title: "Elo",
      k: "K-factor",
      start: "Start rating",
      note: "Elo is recalculated from all matches when a tournament finishes.",
    },
    formats: {
      title: "Default match formats",
      stage: { group: "Groups", ko: "Knockout", final: "Final" },
      start: "Start score",
      bestOf: "Best of",
    },
    boards: "Default number of boards",
    askDoubles: "Ask “darts at double?” when 50 or less is left",
    saved: "Settings saved.",
    errors: {
      pointsEmpty: "The points table needs at least one row.",
      pointsTooMany: "The points table can have at most 30 rows.",
      placeInvalid: "Places must be whole numbers from 1.",
      placeDuplicate: "Each place can only appear once.",
      ptsInvalid: "Points must be whole numbers from 0.",
      eloKInvalid: "K-factor must be a whole number from 1 to 100.",
      eloStartInvalid: "Start rating must be a whole number from 100 to 3000.",
      boardsInvalid: "Boards must be 1–8.",
      formatInvalid: "Pick a valid start score and best-of for each stage.",
    } satisfies Record<SettingsError, string>,
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

  notFound: {
    title: "Not found",
    body: "This page doesn't exist, or it was removed.",
    home: "Back to the ranking",
  },
} as const;

/** "Final", "Semi-final", … "Last 64". */
export function roundLabel(round: { name: RoundName; size: number }): string {
  return round.name === "lastN" ? `${copy.roundNames.lastN} ${round.size}` : copy.roundNames[round.name];
}

/** Elo for display: whole number. */
export function formatElo(elo: number): string {
  return Math.round(elo).toString();
}
