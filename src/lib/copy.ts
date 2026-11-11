// All UI strings live here.

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st. */
function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

import { roundName, type RoundName } from "@/lib/domain/bracket";
import type { PlayerInputError, PlayerSortKey } from "@/lib/domain/players";
import type { SettingsError } from "@/lib/domain/settings";
import type { Format, MatchFormats, StageFormat, StructureError } from "@/lib/domain/structure";
import type { TournamentInputError, TournamentStatus } from "@/lib/domain/tournament";

export const copy = {
  appName: "SAL",
  /** The league's own name (a proper noun, so it stays in Latvian). */
  leagueName: "Superamatieru Līga",
  fullName: "SAL · Superamatieru Līga",
  tagline: "Darts league: ranking, tournaments and live scores",
  crestAlt: "SAL Superamatieru Līga crest",

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

  ranking: {
    period: "Period",
    allTime: "All time",
    summary: {
      tournaments: "Tournaments",
      matches: "Matches",
      t180: "180s",
      highestCheckout: "Highest checkout",
      by: (name: string) => `by ${name}`,
    },
    inProgress: (name: string) => `${name} is in progress`,
    openTournament: "Open tournament",
    watchTv: "TV view",
    podium: (name: string) => `Podium · ${name}`,
    columns: {
      pos: "#",
      move: "Movement",
      player: "Player",
      points: "Pts",
      tournaments: "Played",
      wins: "Wins",
      bestFinish: "Best",
      average: "Avg",
      t180: "180s",
      highestCheckout: "High CO",
      elo: "Elo",
      pointsLong: "Points",
      tournamentsLong: "Tournaments played",
      winsLong: "Tournament wins",
      bestFinishLong: "Best finish",
      averageLong: "3-dart average",
      highestCheckoutLong: "Highest checkout",
    },
    movement: {
      new: "NEW",
      up: (n: number) => `Up ${n}`,
      down: (n: number) => `Down ${n}`,
      same: "No change",
    },
    noResults: "No finished tournaments in this period.",
    place: (n: number) => ordinal(n),
  },

  home: {
    title: "Ranking",
    emptyTitle: "No tournaments yet",
    emptyIntro: "Get the league going in three steps:",
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

  profile: {
    position: "Ranking",
    positionValue: (n: number) => `#${n}`,
    points: "Points",
    elo: "Elo",
    eloChangeHint: "change in their last tournament",
    tiles: {
      average: "3-dart avg",
      first9: "First-9 avg",
      t180: "180s",
      t140: "140+",
      t100: "100+",
      highestCheckout: "Highest checkout",
      checkoutPercent: "Checkout %",
      bestLeg: "Best leg",
      matches: "Matches W–L",
      legs: "Legs W–L",
      wins: "Tournament wins",
      bestFinish: "Best finish",
    },
    winLoss: (won: number, lost: number) => `${won}–${lost}`,
    bestLegValue: (darts: number) => `${darts} darts`,
    eloChart: "Elo over time",
    averageChart: "Average per tournament",
    chartTooFew: "Shown once there are at least two tournaments.",
    chartStart: "Start",
    history: "Tournament history",
    historyColumns: { date: "Date", tournament: "Tournament", place: "Place", points: "Pts", average: "Avg", t180: "180s" },
    recent: "Recent matches",
    headToHead: "Head-to-head",
    h2hColumns: { opponent: "Opponent", record: "W–L" },
    won: "Won",
    lost: "Lost",
    stage: { group: "Groups", ko: "Knockout", third: "Third place" },
    manual: "leg score only",
    none: "Nothing yet.",
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
      k: "Match K-factor",
      placeK: "Placing K-factor",
      start: "Start rating",
      note:
        "Each match moves Elo by up to the match K. When a tournament finishes, every player also 'plays' everyone else by final place (better place wins, shared place draws), worth the placing K in total, so going further always counts. Elo is recalculated from all tournaments whenever one finishes; use “Recalculate results” on a tournament after changing these.",
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
      eloPlaceKInvalid: "Placing K-factor must be a whole number from 0 to 200.",
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
    undoShort: "Undo",
    confirmResult: "Confirm result",
    confirming: "Confirming…",
    toThrow: "to throw",
    legs: "Legs",
    average: "Avg",
    darts: (n: number) => `${n} ${n === 1 ? "dart" : "darts"}`,
    checkoutHint: "Checkout",
    legInfo: (leg: number, bestOf: number, start: number) => `Leg ${leg} · Best of ${bestOf} · ${start}`,
    scoreLabel: "Visit score",
    enter: "Enter",
    enterScore: (name: string) => `Score for ${name}`,
    backspace: "Delete last digit",
    keypad: "Score keypad",
    quick: "Quick scores",
    history: "This leg",
    noVisits: "No visits in this leg yet.",
    checkoutTitle: (score: number) => `Checkout ${score}`,
    doublesTitle: (score: number) => `${score} scored`,
    bustTitle: (score: number) => `Bust (${score})`,
    bustEntry: (score: number) => `Bust (${score})`,
    quickScores: [26, 41, 45, 60, 81, 85, 100, 140, 180],
    cancel: "Cancel",
    matchWon: (name: string) => `${name} wins`,
    statLine: (avg: string, t180: number, best: number) =>
      `Avg ${avg} · 180s ${t180}${best ? ` · Best checkout ${best}` : ""}`,
    saveFailed: "Couldn't save. The scoreboard reloaded from the server; check the last visit.",
    abandon: "Abandon match",
    confirmAbandon: "Abandon and delete visits",
    abandonWarning: "The match goes back to waiting and every visit entered is deleted.",
    keyboardHint: "Keyboard: digits, Enter, Backspace, Ctrl+Z to undo.",
  },

  tv: {
    pageTitle: (name: string) => `${name} · TV`,
    board: (n: number) => `Board ${n}`,
    free: "Free",
    next: "Next",
    versus: "v",
    lastVisit: "Last",
    average: "Avg",
    legs: "Legs",
    toThrow: "Throwing",
    slides: {
      groups: "Group tables",
      bracket: "Bracket",
      leaders: "Today's leaders",
      ranking: "Overall ranking",
    },
    latest: "Latest results",
    noResults: "No results yet.",
    winner: (name: string) => `Winner: ${name}`,
    slideOf: (i: number, n: number) => `${i} of ${n}`,
  },

  board: {
    title: (n: number) => `Board ${n}`,
    loginNeeded: "Board screens are for organizers. Log in with an organizer account.",
    switchLabel: "Switch board",
    tournament: "Tournament page",
    nextMatch: "Next match",
    otherWaiting: "Other waiting matches",
    playHere: "Play here",
    playersBusy: "A player is on another board",
    noneReady: "No match is ready right now. Matches appear here when both players are free.",
    allPlayed: "Every match has been played.",
    tournamentDone: "This tournament is finished.",
    whoStarts: "Who throws first? (bull-up winner)",
    throwsFirst: (name: string) => `${name} throws first`,
    starting: "Starting…",
    errors: {
      not_found: "Match not found.",
      not_organizer: "Only organizers can do this. Log in with an organizer account.",
      tournament_done: "The tournament is finished.",
      groups_closed: "The group stage is over.",
      match_not_pending: "This match has already started or finished.",
      match_not_ready: "Both players must be known before the match can start.",
      bad_board: "That board doesn't exist in this tournament.",
      bad_starter: "Choose who throws first.",
      board_busy: "Another match is already live on this board.",
      player_busy: "One of the players is playing on another board.",
      match_not_live: "This match isn't live any more.",
      match_unfinished: "The match isn't finished yet.",
      bad_winner: "The winner must be one of the two players.",
      next_match_started: "The next match has already started, so the result can't be confirmed. Undo it there first.",
      not_last: "Only the last visit can be undone.",
    },
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

  roundNamesPlural: {
    final: "Final",
    semiFinal: "Semi-finals",
    quarterFinal: "Quarter-finals",
    last16: "Last 16",
    last32: "Last 32",
    lastN: "Last",
  } satisfies Record<RoundName, string>,

  thirdPlace: "Third-place match",

  formatNames: {
    groups_ko: "Groups + knockout",
    ko: "Knockout only",
    rr: "Round robin",
  } satisfies Record<Format, string>,

  tournaments: {
    title: "Tournaments",
    new: "New tournament",
    empty: "No tournaments yet.",
    emptyOrganizer: "No tournaments yet. Create the first one.",
    playerCount: (n: number) => `${n} ${n === 1 ? "player" : "players"}`,
    status: { groups: "Groups", ko: "Knockout", done: "Finished" } satisfies Record<TournamentStatus, string>,
  },

  wizard: {
    title: "New tournament",
    loginNeeded: "Creating tournaments is for organizers. Log in with an organizer account.",
    defaultName: (n: number) => `Event #${n}`,
    sections: {
      details: "Name and date",
      players: "Players",
      structure: "Structure",
      formats: "Match format",
      boards: "Boards",
      preview: "Preview",
    },
    name: "Name",
    date: "Date",
    search: "Search players",
    searchPlaceholder: "Search by name or nickname",
    selected: (n: number) => `${n} selected`,
    selectShown: "Select shown",
    clear: "Clear",
    noPlayers: "No active players yet. Add the first one below.",
    noMatches: "No players match your search.",
    quickAdd: "Add new player",
    format: "Format",
    groups: "Groups",
    advance: "Qualifiers per group",
    thirdPlace: "Third-place match",
    seeding: "Seeding",
    seedingOptions: { elo: "By Elo (snake)", random: "Random" },
    suggest: "Suggest automatically",
    suggestedNote: "Suggested for the number of players and updated as you pick them, until you change a setting.",
    manualNote: "You changed the structure, so it no longer follows the player count.",
    decrease: (what: string) => `Fewer ${what.toLowerCase()}`,
    increase: (what: string) => `More ${what.toLowerCase()}`,
    boards: "Number of boards",
    roundRobinNote: "Everyone plays everyone; places follow the table.",
    stageRr: "Matches",
    preview: {
      groups: (sizes: number[]) =>
        sizes.length === 1 ? `1 group of ${sizes[0]}` : `${sizes.length} groups: ${sizes.join(", ")}`,
      roundRobin: (n: number) => `Round robin, ${n} players`,
      bracket: (label: string, byes: number) => (byes ? `${label}, ${byes} ${byes === 1 ? "bye" : "byes"}` : label),
      thirdPlace: "plus a third-place match",
      matches: (n: number) => `${n} ${n === 1 ? "match" : "matches"}`,
      duration: "Estimated duration",
      split: (groups: string, knockout: string) => `Groups ${groups} · Knockout ${knockout}`,
      selectPlayers: "Select at least 2 players to see the preview.",
    },
    submit: "Create tournament",
    creating: "Creating…",
    inputErrors: {
      nameRequired: "Enter a name.",
      nameTooLong: "Name is too long (max 80 characters).",
      dateInvalid: "Pick a valid date.",
      duplicatePlayers: "A player is selected twice.",
      boardsInvalid: "Boards must be 1–8.",
      formatInvalid: "Pick a valid start score and best-of for each stage.",
      tooFewPlayers: "Select at least 2 players.",
      groupTooSmall: "Each group needs at least 2 players.",
      advanceTooHigh: "Qualifiers per group can't exceed the smallest group.",
      advanceOutOfRange: "Qualifiers per group must be 1–4.",
      knockoutTooSmall: "The knockout needs at least 2 players.",
    } satisfies Record<TournamentInputError, string>,
    invalidInput: "Some tournament details are invalid. Reload the page and try again.",
    playersChanged: "Some selected players were archived or removed. Reload the page and try again.",
  },

  tournament: {
    back: "All tournaments",
    progress: (done: number, total: number) => `${done} / ${total} matches`,
    progressLabel: "Progress",
    boards: "Boards",
    board: (n: number) => `Board ${n}`,
    tv: "TV view",
    startKnockout: "Start knockout",
    startKnockoutHint: "All group matches are done. The bracket is drawn from the final tables.",
    redraw: "Redraw groups",
    redrawHint: "Possible until the first group match starts.",
    redrawElo: "Redraw by Elo",
    redrawRandom: "Redraw randomly",
    delete: "Delete tournament",
    confirmDelete: "Delete permanently",
    deleteWarning: "This removes the tournament with all its matches and scores. It can't be undone.",
    working: "Working…",
    tabs: { groups: "Groups", bracket: "Bracket", matches: "Matches", stats: "Stats", results: "Results" },
    tabsLabel: "Tournament sections",
    groupName: (i: number) => `Group ${String.fromCharCode(65 + i)}`,
    table: {
      pos: "#",
      player: "Player",
      played: "P",
      wins: "W",
      losses: "L",
      legs: "Legs",
      diff: "+/−",
      playedLong: "Played",
      winsLong: "Won",
      lossesLong: "Lost",
      diffLong: "Leg difference",
    },
    qualifies: "Qualifies",
    qualifyLegend: (n: number) => `Top ${n} of each group go through to the knockout.`,
    groupMatches: "Matches",
    roundShort: (n: number) => `R${n}`,
    bracketPending: "The bracket is drawn when all group matches are done and the knockout starts.",
    lists: { live: "Live", waiting: "Waiting", finished: "Finished" },
    noLive: "No match is being played.",
    noWaiting: "No matches waiting.",
    noFinished: "No finished matches yet.",
    groupRound: (group: string, round: number) => `${group} · Round ${round}`,
    tbd: "TBD",
    bye: "Bye",
    manual: "Entered manually",
    winner: "winner",
    standings: "Table",
    onBoard: (n: number) => `Board ${n}`,
    bestOf: (start: number, bestOf: number) => `${start} · Best of ${bestOf}`,
    enterResult: "Enter result",
    editResult: "Edit result",
    legsFor: (name: string) => `Legs won by ${name}`,
    saveResult: "Save result",
    resultHint: (bestOf: number) => `Legs only, first to ${Math.ceil(bestOf / 2)}. No visit stats are recorded.`,
    unknownPlayer: "Unknown player",
    errors: {
      not_found: "Tournament not found.",
      not_organizer: "Only organizers can do this. Log in with an organizer account.",
      groups_started: "A group match has already started, so groups can't be redrawn.",
      groups_closed: "The group stage is over.",
      knockout_not_allowed: "The knockout can't be started for this tournament.",
      groups_unfinished: "Finish every group match before starting the knockout.",
      knockout_exists: "The knockout has already started.",
      is_bye: "A bye has no result to enter.",
      match_live: "This match is being played on a board right now.",
      has_visits: "This match was scored visit by visit, so its leg score can't be edited here.",
      bad_winner: "The winner must be one of the two players.",
      tournament_done: "The tournament is finished.",
      next_match_started: "The next match has already started, so this winner can't change.",
      nextMatchStarted: "The next match has already started, so this winner can't change.",
      invalidScore: "Enter a finished score: one player must reach the winning number of legs.",
      notEditable: "This match's result can't be entered here.",
      alreadyFinished: "The tournament is already finished.",
      already_finished: "The tournament is already finished.",
      matchesUnfinished: "Finish every match first, including live ones.",
      matches_unfinished: "Finish every match first, including live ones.",
      knockoutMissing: "Start the knockout and finish it first.",
      knockout_missing: "Start the knockout and finish it first.",
      not_finished: "Only a finished tournament can be recalculated.",
      results_incomplete: "Not every player could be placed. Check that all matches have a winner.",
    },
    finish: "Finish tournament",
    finishHint: "Every match is done. Finishing freezes places and points and recalculates Elo.",
    recalculate: "Recalculate results",
    recalculateHint:
      "Re-freezes places and points with the current points table and recalculates Elo. Use it after changing settings.",
    recalculated: "Results recalculated.",
    deleteFinishedWarning:
      "This removes the tournament with all its matches, scores and results, and recalculates Elo without it. It can't be undone.",
    statsEmpty: "Stats appear once matches are scored visit by visit on a board.",
    leaders: "Leaders",
    leaderLabels: {
      average: "Best average",
      t180: "Most 180s",
      highestCheckout: "Highest checkout",
      bestLeg: "Best leg",
    },
    statsColumns: {
      player: "Player",
      average: "Avg",
      first9: "First 9",
      t180: "180",
      t140: "140+",
      t100: "100+",
      highestCheckout: "High CO",
      checkoutPercent: "CO %",
      bestLeg: "Best leg",
      averageLong: "3-dart average",
      first9Long: "First-9 average",
      highestCheckoutLong: "Highest checkout",
      checkoutPercentLong: "Checkout percentage",
      bestLegLong: "Fewest darts in a won leg",
    },
    resultsPending: "Places and points appear here once the tournament is finished.",
    resultsColumns: { place: "Place", player: "Player", points: "Points", elo: "Elo" },
    dartsCount: (n: number) => `${n} darts`,
  },

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

/** "Quarter-finals", "Semi-finals", "Final", "Last 64". */
export function roundLabelPlural(round: { name: RoundName; size: number }): string {
  return round.name === "lastN" ? `${copy.roundNamesPlural.lastN} ${round.size}` : copy.roundNamesPlural[round.name];
}

function stageText(f: StageFormat): string {
  return `${f.start} bo${f.bestOf}`;
}

/**
 * "4 groups · top 2 · Quarter-finals · Groups 301 bo3 · Knockout 501 bo5 · Final 501 bo7".
 * `firstRound` is the first knockout round (null without a knockout).
 */
export function formatSummary(t: {
  format: Format;
  groupCount: number;
  advance: number;
  rounds: number;
  firstRound: { name: RoundName; size: number } | null;
  fmt: MatchFormats;
}): string {
  const parts: string[] = [];
  if (t.format === "rr") {
    parts.push(copy.formatNames.rr, `${copy.wizard.stageRr} ${stageText(t.fmt.group)}`);
    return parts.join(" · ");
  }
  if (t.format === "groups_ko") {
    parts.push(t.groupCount === 1 ? "1 group" : `${t.groupCount} groups`, `top ${t.advance}`);
  }
  if (t.firstRound) parts.push(roundLabelPlural(t.firstRound));
  if (t.format === "groups_ko") parts.push(`${copy.settings.formats.stage.group} ${stageText(t.fmt.group)}`);
  if (t.rounds >= 2) parts.push(`${copy.settings.formats.stage.ko} ${stageText(t.fmt.ko)}`);
  if (t.rounds >= 1) parts.push(`${copy.settings.formats.stage.final} ${stageText(t.fmt.final)}`);
  return parts.join(" · ");
}

/** "Group B · Round 2", "Quarter-final", "Third-place match". */
export function matchLabel(
  m: { stage: "group" | "ko" | "third"; groupIndex: number | null; round: number },
  rounds: number,
): string {
  if (m.stage === "group") return copy.tournament.groupRound(copy.tournament.groupName(m.groupIndex ?? 0), m.round);
  if (m.stage === "third") return copy.thirdPlace;
  return roundLabel(roundName(m.round, rounds));
}

/** 3-dart average for display: one decimal, "–" without darts. */
export function formatAverage(avg: number | null): string {
  return avg === null ? "–" : avg.toFixed(1);
}

/** Elo change for display: "+16", "−4", "0". */
export function formatEloChange(change: number): string {
  const r = Math.round(change);
  return r > 0 ? `+${r}` : r < 0 ? `−${Math.abs(r)}` : "0";
}

export function formatPercent(p: number | null): string {
  return p === null ? "–" : `${p.toFixed(1)}%`;
}

/** Elo for display: whole number. */
export function formatElo(elo: number): string {
  return Math.round(elo).toString();
}
