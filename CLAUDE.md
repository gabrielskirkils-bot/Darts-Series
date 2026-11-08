# Darts Tournament Series

App for a darts tournament series: player profiles, tournaments with an auto-adapted structure, a scoreboard at each board, a TV view, and a ranking (points + Elo). Full spec: `SPEC.md`. Read the relevant SPEC section before building any feature.

## Stack
- Next.js (App Router) + TypeScript (strict), Tailwind CSS
- Supabase: Postgres, Auth (magic link), Realtime. Schema: `supabase/migrations/`
- Vitest for domain logic, Playwright for key flows
- Hosting: Vercel

## Supabase access
- The Supabase MCP server is configured in `.mcp.json` (scoped to this project). Use it to apply migrations, inspect tables, generate TypeScript types and get the project URL / publishable key for `.env.local`.
- Apply schema changes only as migration files in `supabase/migrations/`, then apply them through the MCP.
- Never run destructive SQL (drop, truncate, delete without a where clause) without asking first.

## Commands
- `npm run dev` — local
- `npm test` — Vitest
- `npm run test:e2e` — Playwright
- `npm run lint && npm run typecheck`
- `npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts` — after every migration

## Structure
- `src/lib/domain/` — pure game and tournament logic (no React, no Supabase, no `Date.now()` inside; pass time in as an argument). A `*.test.ts` next to every file.
  - `rules.ts` (validation, bust, finishable scores), `checkout.ts`, `structure.ts` (suggestion, duration), `groups.ts` (snake, round robin, standings), `bracket.ts` (seeds, bracket, byes, advancement), `placements.ts`, `points.ts`, `elo.ts`, `stats.ts`
- `src/lib/supabase/` — server/browser clients, generated types, data access functions
- `src/app/` — routes per SPEC section 6
- `src/components/` — UI; `src/components/scoreboard/` separately

## Rules
- **Everything in English**: UI copy, code, database, comments. Keep UI strings in one place: `src/lib/copy.ts`.
- Never compute stats or standings in components: only in `src/lib/domain/` or SQL views.
- Every domain function has tests, including the edge cases in SPEC section 8, before the UI uses it.
- Writes are organizer-only: rely on RLS, and also hide actions from anonymous users in the UI.
- Multi-row changes (create tournament, generate knockout, finish, Elo recompute) run in one transaction (Postgres function or Server Action).
- Schema changes only as a new migration; never edit one that has already run.
- Scoreboard: optimistic UI, tap targets ≥ 56px, works on a phone in portrait and a tablet in landscape, supports a physical keyboard.
- TV and public pages work without login.
- Respect `prefers-reduced-motion`.

## Definition of done
Tests green, typecheck and lint clean, feature checked in the browser at phone and tablet sizes, and it matches its SPEC section.
