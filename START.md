# Getting started (Claude Code)

## 1. Create the Supabase project (~5 min)
1. Go to supabase.com and sign up (GitHub login is easiest).
2. **New project**:
   - Name: `darts-series`
   - Database password: generate one, save it in your password manager
   - Region: **Central EU (Frankfurt)** (closest to Riga)
   - Plan: Free
3. Wait ~2 minutes while it starts.
4. **Project Settings → General → Project ID**: copy it (looks like `abcdefghijklmnop`).

You don't need to run any SQL yourself — Claude Code will do it in step 2.

## 2. Set up the project folder and Claude Code (~5 min)
Requirements: Node.js LTS (nodejs.org) and Claude Code installed.

```bash
# unzip darts-series.zip, then:
cd darts-series
git init

# connect Claude Code to your Supabase project (replace YOUR_PROJECT_ID)
claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_ID&features=database,docs,development"

claude
```

Inside Claude Code:
1. Type `/mcp` → choose **supabase** → **Authenticate** → log in to Supabase in the browser that opens.
2. Paste the first task:

```
Read CLAUDE.md and SPEC.md. First, use the Supabase MCP to apply
supabase/migrations/0001_init.sql to my project and confirm the tables exist.
Then build the app in phases, starting with phase 1 from START.md.
Show me a short plan before writing code.
```

## 3. Phases (after each: test it → ask for a commit → next phase)
1. **Foundation:** Next.js, Supabase clients, all game logic with tests
2. **Players, login, settings**
3. **Tournament wizard and tournament page**
4. **Scoreboard and boards** (the most important one; test with 2 browser tabs as 2 boards)
5. **Finishing tournaments, ranking, profiles**
6. **TV view and deploy to Vercel**

Start the next phase with: `Phase 1 is done. Continue with phase 2 from START.md.`

## 4. Make yourself an organizer
After you log in to the app for the first time, ask Claude Code:

```
Add my account (my email) to the organizers table.
```

Repeat for everyone who will enter scores. Without this, the app is read-only for you.
