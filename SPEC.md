# Darts Tournament Series — Product Spec

An interactive app for a darts tournament series: player profiles, a tournament structure that adapts to the number of entrants, visit-by-visit scoring at every board with full stats, a TV view for spectators, and an overall ranking (points + Elo).

Language: **English** for the whole app (UI, code, database, comments).

---

## 1. Decisions

| Topic | Decision |
|---|---|
| Game | X01, **double-out** always. Start score set per stage (e.g. groups 301, play-offs 501) |
| Entrants | Highly variable, 4–32+. Structure is suggested automatically; the organizer can override |
| Formats | Groups + knockout (default), knockout only, round robin. Architecture must allow adding double elimination later |
| Stats | **Full**: every visit (3-dart total) is entered, all stats are computed |
| Ranking | Points per finishing place (official ranking) + Elo rating alongside |
| Devices | A phone/tablet at each board, plus a TV screen for spectators. Everything syncs in real time |
| Boards | Usually 2–3 (configurable 1–8 per tournament) |
| Seasons | None for now; ranking accumulates all-time. Data model must allow seasons later (period filter from day one) |
| Access | Ranking, profiles, tournaments and TV are **public without login**. Only organizers can write (Supabase Auth) |
| Stack | Next.js (App Router, TypeScript) + Supabase (Postgres, Auth, Realtime), hosted on Vercel |

---

## 2. Roles and devices

- **Spectator (anonymous):** sees ranking, player profiles, tournaments, TV. Cannot change anything.
- **Organizer (logged in, listed in `organizers`):** creates players and tournaments, enters scores, fixes mistakes, edits settings.
- **Board device:** tablet/phone at a board, logged in as an organizer. Opens `/t/[id]/board/[n]` and enters visits.
- **TV:** a browser on `/t/[id]/tv`, public, no login, updates itself.

---

## 3. Game rules (X01, double-out)

- A visit = up to 3 darts. The **visit total** 0–180 is entered.
- Impossible totals (reject): `163, 166, 169, 172, 173, 175, 176, 178, 179`, and anything > 180.
- **Bust:** if `score > remaining` or `remaining − score == 1`. Saved with `bust = true`; counts as 0 points and 3 darts in stats.
- **Checkout:** if `score == remaining`. Allowed only if `remaining` can be finished on a double at all: `remaining ≤ 170` and not one of `159, 162, 163, 165, 166, 168, 169`. Otherwise error "Can't check out from X".
- Legs alternate the starting player. The leg-1 starter is chosen before the match (bull-up winner).
- Match: `best_of` legs (1, 3, 5, 7, 9). First to `ceil(best_of / 2)` wins.

---

## 4. Features

### 4.1 Players
- Create (name required, nickname optional), edit, archive (never delete a player with matches).
- Duplicate-name warning (case-insensitive).
- List with search: name, Elo, total points, tournaments played.

### 4.2 Player profile `/players/[id]`
- Header: name, nickname, ranking position, points, Elo (+ change in last tournament).
- Stat tiles (all-time and selected period): 3-dart average, first-9 average, 180s, 140+, 100+, highest checkout, checkout %, best leg (darts), matches W–L, legs W–L, tournament wins, best finish.
- Elo chart over time; average per tournament chart.
- Tournament history: date, tournament, place, points, average, 180s.
- Recent matches; head-to-head record vs each opponent (W–L).

### 4.3 Tournament wizard `/tournaments/new`
One page with sections; the preview updates live.

1. **Name** (default "Event #N"), **date** (today).
2. **Players:** selectable player chips with search, counter, quick-add new player inline.
3. **Structure:** format; number of groups G; qualifiers per group A (1–4); third-place match; seeding by Elo (snake) or random. "Suggest automatically" button.
4. **Match format** for three stages: Groups / Knockout / Final, each with start score (301/501/701) and best of. Defaults from settings (groups 301 bo3, knockout 501 bo5, final 501 bo7).
5. **Number of boards.**
6. **Preview:** group sizes ("3 groups: 4, 4, 3"), bracket size and byes ("Quarter-finals, 2 byes"), match count, **estimated duration**.

**Auto-suggestion** (n = entrants):
- n 2–3: round robin.
- n 4–5: 1 group, top 2 advance (final).
- n ≥ 6: `G = max(2, round(n / 4))`, top 2 advance. Bracket size = smallest power of 2 ≥ `G × A`; empty slots = byes for the top seeds.

The suggestion recalculates as entrants change, until the organizer edits the structure manually.

**Validation:** each group ≥ 2 players; `A ≤` smallest group size; knockout needs ≥ 2 players.

**Duration estimate:**
- minutes per leg: 301 → 4.5; 501 → 7; 701 → 10
- expected legs: bo1 = 1, otherwise `(k+1)/2 + (k−1)/2 × 0.6`
- match time = legs × min/leg + 1.5 min changeover
- groups: Σ match time / boards; knockout: per round `ceil(matches / boards) × match time`.

**On create:** players sorted (Elo descending or random), split into groups by snake (`row = i div G`; even rows column `i mod G`, odd rows `G−1−(i mod G)`), all group matches generated. While no group match has started, a **"Redraw groups"** button is available.

### 4.4 Group stage
- Round robin via the circle method (add a dummy for odd counts). Rounds interleave across groups so all boards stay busy: round 1 for every group, then round 2, etc. → `sort_order`.
- **Table order:** wins → leg difference → legs won → head-to-head (if 2 tied) → 3-dart average.
- Qualifying rows highlighted.

### 4.5 Knockout stage
Organizer presses "Start knockout" once all group matches are done.

- **Seeds:** tier 1 = group winners in group order (A, B, C…; A holds the top seed thanks to snake). Tier 2 = runners-up in reverse group order. Tier 3+ by performance.
- **Bracket:** standard order `seedOrder(size)`: start with `[1,2]`; each step `n = len × 2`, each `s` → `[s, n+1−s]`. First-round pairs are adjacent entries.
- **No same-group meetings in round 1:** if a pair is from the same group, swap the lower seed with another player of the same tier when that creates no new clash (repeat until stable; skip when G = 1).
- **Byes:** a pair missing a player is immediately `done`, `is_bye = true`, and the player advances.
- **Advancement:** match (round r, slot s) → next match (r+1, s div 2), as p1 if s is even, else p2. Semi-final losers → third-place match (if enabled and no semi-final contains a bye).
- Round names from the end: Final, Semi-final, Quarter-final, Last 16, Last 32.
- In "knockout only", seeds follow Elo (or random).

### 4.6 Board queue
- Board screen `/t/[id]/board/[n]`: if a match is live on this board → scoreboard. Otherwise a **"Next match"** card + other waiting matches with a "Play here" button.
- Next match = pending match with both players, not a bye, whose players are not currently playing elsewhere, lowest `sort_order`.
- Starting: choose who throws first → `status = live`, `board = n`.
- Board number switchable in the header (1…boards).

### 4.7 Scoreboard (the core screen; must be very fast)
**Layout:** two player panels (name, remaining score in VERY large numerals, legs won, match average, darts this leg, checkout suggestion), active player highlighted. Leg visit history. Number keypad.
- Tablet landscape: panels + history left, keypad right. Phone: stacked, panels side by side.
- Quick buttons: 26, 41, 45, 60, 81, 85, 100, 140, 180.
- Physical keyboard: digits, Enter, Backspace, Ctrl+Z.

**Input flow:**
1. Validate the total (section 3).
2. If checkout → dialog: "Darts used this visit?" (minimum possible to 3) and "Darts at double?" (1…darts used).
3. If `remaining ≤ 50` at the start of the visit and it's not a checkout → quick prompt "Darts at double?" 0/1/2/3 (one tap saves). Can be turned off in settings.
4. Otherwise the visit saves immediately.
5. After a checkout: if the match isn't over, the next leg starts (other player throws first).
6. **Match end:** overlay with winner, score and a short stat line. Buttons "Undo last visit" and "Confirm result". Only on confirm: `status = done`, `winner_id`, winner advances in the knockout, board is freed.

**Undo:** deletes the last visit; if a leg just ended, it reopens that leg.

**Checkout suggestion** (remaining 2–170): find the route with the fewest darts. Segments: T1–T20, S1–S20, 25, Bull (50), D1–D20; the last dart must be a double (D1–D20 or Bull). Among equal dart counts pick the lowest "cost": double preference D20, D16, D8, D18, D12, D10, D4, D14, D6, D19…, Bull last; setup darts T20 < T19 < T18 < other T < big singles < 25 < Bull < D. Cache per remaining score. Examples: 170 = T20 T20 Bull, 100 = T20 D20, 40 = D20.

**Fallback entry** (no device available): the organizer can enter just the leg score on the tournament page (`is_manual = true`, no visit stats). Editing a finished knockout match swaps the winner in the next match only if that match hasn't started; otherwise show an error.

**Abandon match:** back to `pending`, deletes visits (with confirmation).

### 4.8 Tournament page `/t/[id]` (organizer; read-only for the public)
- Header: name, date, status, format summary ("4 groups · top 2 · Quarter-finals · Groups 301 bo3 · Knockout 501 bo5 · Final 501 bo7"), progress bar (matches done / total).
- Links: each board screen, TV view.
- Contextual action: "Start knockout" / "Finish tournament" / "Recalculate results" (after edits).
- Tabs: **Groups** (tables + matches), **Bracket**, **Matches** (live / waiting / finished, with actions), **Stats** (per-player stats for the day + leaders), **Results** (places and points once finished).
- Delete tournament (with confirmation).

### 4.9 Finishing, places, points
**Places:**
- Round robin: place = table position.
- Knockout: final winner 1, loser 2. Third-place match → 3 and 4; without it both semi-final losers share 3rd. Losers in the round that is k-th from the end get place `2^(k−1) + 1` (quarter-final → 5, last 16 → 9).
- Eliminated in groups: by group position; everyone with the same group position shares a place, starting at `qualifiers + 1` (e.g. 8 qualified → all 3rd-placed group players share 9th, 4th-placed share the next place).

**Points table** (configurable, each row = "from place X"): 1 → 100, 2 → 75, 3 → 60, 4 → 50, 5 → 40, 9 → 25, 17 → 15, 33 → 10. A place gets the points of the largest row with `X ≤ place`.

On finish, `tournament_results` stores place and points (frozen, so later table changes don't rewrite history; "Recalculate" updates deliberately). Then Elo is recalculated.

### 4.10 Ranking `/` (home)
- Period: "All time" or a specific year (later: season).
- Summary: tournaments, matches, total 180s, highest checkout (and by whom).
- If a tournament is in progress: banner linking to it and its TV view.
- Table: position, movement (▲/▼ vs ranking before the last tournament; "NEW"), player, points, tournaments, wins, best finish, 3-dart avg, 180s, highest checkout, Elo (+ change).
- Sort: points → wins → average. Equal points = shared position.
- Podium of the last tournament.
- Empty state: 3-step onboarding (add players → create tournament → open a board).

### 4.11 Elo
- Start 1500; match K = 16, placing K = 48 (both configurable).
- All finished matches (not byes; fallback entries included), chronologically: tournament date, then `finished_at`.
- `E_a = 1 / (1 + 10^((R_b − R_a) / 400))`, `R_a' = R_a + K × (S_a − E_a)`.
- **Placing step:** after a finished tournament's last match, every pair of entrants counts as one more result decided by final place (better place = 1, shared place = 0.5), each worth `placing K / (entrants − 1)`. Going further always counts: e.g. a player out in the groups ends below one who lost their first playoff match. The step is stored on each player's last match row of that tournament (no extra rows).
- Always recompute fully (data is small) and store `elo_history`. "Elo change" for a tournament = rating after the player's last match there − rating before their first.
- Also used for seeding in the wizard.

### 4.12 Stat definitions
- **3-dart average** = points / darts × 3 (bust = 0 points, 3 darts; checkout uses actual darts).
- **First-9 average** = the first 3 visits of each leg.
- **180 / 140+ / 100+:** visit total (not bust) 180, 140–179, 100–139.
- **Highest checkout:** largest checkout total.
- **Checkout %** = checkouts / darts at double.
- **Best leg:** fewest darts in a won leg.
- Fallback-entry matches count only for W–L and legs.

### 4.13 TV view `/t/[id]/tv`
- Full screen 16:9, large type (vw units), dark.
- Left: each board — the match with both players, remaining scores, legs, who's throwing, last visit, average; if the board is free, "Next: A vs B".
- Right rotates every 12 s (with a progress bar): group tables → bracket → today's leaders (average, 180s, checkout, best leg) → overall ranking top 10.
- Bottom: latest results.
- Updates via Supabase Realtime, no reload. `prefers-reduced-motion` → no animation.

### 4.14 Settings `/settings` (organizer)
Points table (add/remove rows), Elo match K, placing K and start rating, default formats for the three stages, default board count, "Ask darts at double".

---

## 5. Architecture

- **Next.js App Router + TypeScript.** Public pages: server components reading Supabase (anon key); live parts (scoreboard, TV, tournament page) are client components with Realtime.
- **Supabase:** Postgres (schema `supabase/migrations/0001_init.sql`), Auth (email magic link for organizers), Realtime on `matches`, `visits`, `legs`, `tournaments`. RLS: everyone reads, only `is_organizer()` writes.
- **Domain logic** in `src/lib/domain/` — pure TypeScript, no I/O: rules, checkout, structure suggestion, groups, bracket, standings, places, points, Elo, stats. All covered by **Vitest**.
- Mutations from the client via Supabase JS (RLS protects). Multi-row operations (create tournament, generate knockout, finish, Elo recompute) run as Postgres functions (RPC) or Server Actions so they are atomic.
- **Scoreboard:** optimistic local state; a visit = one `visits` insert; undo = delete the last row. Unique key `(match_id, leg_no, seq)` guards against double entry.
- **Look:** the league's brand, **SAL · Superamatieru Līga** (crest in `Logo/`, cut out to `public/brand/sal-crest.png`). Dark navy UI from the crest's colours: navy background, white text, beer gold for highlights and primary buttons, the crest's red for live/danger (lighter red for text), green only for wins and checkouts; a navy/red split stripe under the header. Headings in heavy italic condensed type like the crest's "SAL"; condensed numerals with `tabular-nums`. The crest appears in the header, favicon/app icons, the ranking hero, the TV view and the login page. Mobile-first, large tap targets on the scoreboard (min 56px).

## 6. Routes
| Route | What | Access |
|---|---|---|
| `/` | Ranking | public |
| `/players`, `/players/[id]` | Players, profile | public (edit — organizer) |
| `/tournaments`, `/tournaments/new` | List, wizard | list public, wizard organizer |
| `/t/[id]` | Tournament | public (actions — organizer) |
| `/t/[id]/board/[n]` | Board screen | organizer |
| `/t/[id]/tv` | TV | public |
| `/settings` | Settings | organizer |
| `/login` | Magic link | — |

## 7. Later (don't build now, don't block)
Seasons (`seasons` table, `season_id` on tournaments, "best N results"), double elimination, Cricket, board PIN without a full account, PWA with offline queue, bonus points (180s, highest checkout), CSV export.

## 8. Acceptance criteria
1. With 11 players the wizard suggests 3 groups (4, 4, 3), top 2, quarter-finals with 2 byes, and shows match count and duration.
2. Two tablets on different boards enter visits at the same time; the TV shows both remaining scores within 2 s.
3. On 32 remaining: entering 32 → asks darts; entering 31 → bust (leaves 1); entering 33 → bust.
4. Entering 179 → error "Impossible score".
5. Undoing a checkout reopens the leg and restores the remaining score.
6. After both semi-finals are confirmed, the final and third-place match contain the right players automatically.
7. Finishing a tournament updates ranking, Elo and profiles; movement arrows are correct.
8. An anonymous user sees ranking and TV but cannot write anything (RLS blocks direct API calls too).
9. All domain functions are tested, including byes, 3 groups, same-group clash avoidance and shared places.
