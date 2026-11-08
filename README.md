# Darts Series

App for a darts tournament series: player profiles, tournaments with an automatically suggested
structure, a scoreboard at each board, a TV view for spectators, and a ranking (points + Elo).
The full product spec is in [SPEC.md](SPEC.md); working rules for contributors are in [CLAUDE.md](CLAUDE.md).

Stack: Next.js (App Router, TypeScript) · Supabase (Postgres, Auth, Realtime) · Tailwind CSS ·
Vitest · Playwright · hosted on Vercel.

## Run it locally

1. Node.js 22 or newer.
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable key
   (Supabase dashboard → Project Settings → API).
3. Install and start:

   ```bash
   npm install
   npm run dev
   ```

4. Open <http://localhost:3000>, log in with your email (magic link), then add your account to the
   `organizers` table (SQL editor: `insert into organizers (user_id) select id from auth.users where email = 'you@example.com';`).
   Without that the app is read-only for you.

## Database

Schema changes live in `supabase/migrations/` and are applied in order:

| File | What it adds |
|---|---|
| `0001_init.sql` | Tables, RLS (everyone reads, organizers write), Realtime, stats views |
| `0002_player_summary.sql` | `player_summary` view (Elo, points, tournaments per player) |
| `0003_tournament_functions.sql` | Create tournament, redraw groups, start knockout, fallback results |
| `0004_scoreboard_functions.sql` | Start match, record / undo visit, confirm, abandon |
| `0005_results_functions.sql` | Finish / recalculate results, delete tournament, Elo history |

Migrations 0003–0005 were applied by pasting them into the Supabase SQL editor, so they don't
appear in Supabase's migration history. After a schema change, regenerate the types:

```bash
npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server on port 3000 |
| `npm test` | Unit tests (Vitest) for the domain logic in `src/lib/domain/` |
| `npm run test:e2e` | Playwright tests (phone and tablet), reusing the dev server |
| `npm run lint && npm run typecheck` | ESLint and TypeScript |
| `npm run build` | Production build |

## Deploy to Vercel

1. Push this repository to GitHub (or GitLab / Bitbucket).
2. In Vercel: **Add New → Project**, import the repository. The framework (Next.js) is detected.
3. Add the environment variables `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (same values as `.env.local`), then deploy.
4. In Supabase → **Authentication → URL Configuration**:
   - set **Site URL** to the production URL, e.g. `https://darts-series.vercel.app`;
   - add `https://darts-series.vercel.app/auth/callback` to **Redirect URLs**
     (keep `http://localhost:3000/auth/callback` for local development).
5. Log in on the deployed site once to check the magic link works.

Supabase's built-in email sender only delivers to members of your Supabase organization and has
a low hourly limit. If other organizers need to log in, set up custom SMTP in Supabase
(Authentication → Emails → SMTP settings) or invite them to the Supabase organization.

## At an event

- **Organizers** create the tournament at `/tournaments/new`.
- **Each board**: a phone or tablet, logged in as an organizer, on `/t/<id>/board/<n>`.
- **TV**: open `/t/<id>/tv` in any browser (no login) and switch it to full screen (F11).
  It updates live and rotates group tables, bracket, leaders and the ranking every 12 seconds.
