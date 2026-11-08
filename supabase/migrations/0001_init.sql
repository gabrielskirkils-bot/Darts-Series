-- Darts Tournament Series — initial schema
-- Everyone (including anonymous) can read; only organizers can write (RLS).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- Organizers
-- ---------------------------------------------------------------
create table public.organizers (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_organizer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.organizers where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------
create table public.settings (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{
    "points": [{"place":1,"pts":100},{"place":2,"pts":75},{"place":3,"pts":60},{"place":4,"pts":50},
               {"place":5,"pts":40},{"place":9,"pts":25},{"place":17,"pts":15},{"place":33,"pts":10}],
    "eloK": 32,
    "eloStart": 1500,
    "boards": 2,
    "askDoubles": true,
    "fmt": {
      "group": {"start": 301, "bestOf": 3},
      "ko":    {"start": 501, "bestOf": 5},
      "final": {"start": 501, "bestOf": 7}
    }
  }'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- ---------------------------------------------------------------
-- Players
-- ---------------------------------------------------------------
create table public.players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  nickname   text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index players_name_unique on public.players (lower(trim(name)));

-- ---------------------------------------------------------------
-- Tournaments
-- ---------------------------------------------------------------
create table public.tournaments (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  date         date not null default current_date,
  status       text not null default 'groups' check (status in ('groups', 'ko', 'done')),
  format       text not null check (format in ('groups_ko', 'ko', 'rr')),
  group_count  int  not null default 1 check (group_count between 1 and 32),
  advance      int  not null default 2 check (advance between 0 and 8),
  third_place  boolean not null default false,
  seeding      text not null default 'elo' check (seeding in ('elo', 'random')),
  boards       int  not null default 2 check (boards between 1 and 8),
  -- {"group":{"start":301,"bestOf":3},"ko":{...},"final":{...}}
  fmt          jsonb not null,
  -- set when the knockout starts: {"rounds":3,"size":8,"qualified":6,"third":true}
  ko           jsonb,
  season_id    uuid,             -- reserved for future seasons
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index tournaments_date_idx on public.tournaments (date);

create table public.tournament_players (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  player_id     uuid not null references public.players (id),
  seed          int  not null,            -- 1 = top seed
  group_index   int,                      -- 0 = A, 1 = B …; null for format 'ko'
  primary key (tournament_id, player_id)
);

-- ---------------------------------------------------------------
-- Matches
-- ---------------------------------------------------------------
create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  stage         text not null check (stage in ('group', 'ko', 'third')),
  group_index   int,
  round         int  not null default 0,
  slot          int  not null default 0,
  sort_order    int  not null default 0,
  p1            uuid references public.players (id),
  p2            uuid references public.players (id),
  start_score   int  not null check (start_score in (301, 501, 701)),
  best_of       int  not null check (best_of % 2 = 1 and best_of between 1 and 15),
  status        text not null default 'pending' check (status in ('pending', 'live', 'done')),
  board         int,
  winner_id     uuid references public.players (id),
  legs_p1       int  not null default 0,
  legs_p2       int  not null default 0,
  is_bye        boolean not null default false,
  is_manual     boolean not null default false,
  started_at    timestamptz,
  finished_at   timestamptz,
  updated_at    timestamptz not null default now()
);
create index matches_tournament_idx on public.matches (tournament_id, sort_order);
create unique index matches_ko_slot_unique
  on public.matches (tournament_id, stage, round, slot) where stage in ('ko', 'third');

create table public.legs (
  match_id  uuid not null references public.matches (id) on delete cascade,
  leg_no    int  not null,                 -- 1, 2, 3 …
  starter   smallint not null check (starter in (0, 1)),   -- 0 = p1, 1 = p2
  winner    smallint check (winner in (0, 1)),
  primary key (match_id, leg_no)
);

create table public.visits (
  id               bigint generated always as identity primary key,
  match_id         uuid not null references public.matches (id) on delete cascade,
  leg_no           int  not null,
  seq              int  not null,           -- order within the leg, 1, 2, 3 …
  player           smallint not null check (player in (0, 1)),
  score            int  not null check (score between 0 and 180),
  darts            smallint not null default 3 check (darts between 1 and 3),
  darts_at_double  smallint not null default 0 check (darts_at_double between 0 and 3),
  bust             boolean not null default false,
  is_checkout      boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (match_id, leg_no, seq),
  foreign key (match_id, leg_no) references public.legs (match_id, leg_no) on delete cascade
);

-- ---------------------------------------------------------------
-- Results and Elo (written on finish / recalculate)
-- ---------------------------------------------------------------
create table public.tournament_results (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  player_id     uuid not null references public.players (id),
  place         int  not null,
  points        int  not null,
  primary key (tournament_id, player_id)
);

create table public.elo_history (
  match_id      uuid not null references public.matches (id) on delete cascade,
  player_id     uuid not null references public.players (id),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  rating_before numeric(7,2) not null,
  rating_after  numeric(7,2) not null,
  played_at     timestamptz not null,
  primary key (match_id, player_id)
);
create index elo_history_player_idx on public.elo_history (player_id, played_at);

-- ---------------------------------------------------------------
-- Stats views
-- ---------------------------------------------------------------
create or replace view public.player_tournament_stats
with (security_invoker = true) as
with v as (
  select
    m.tournament_id,
    case when vi.player = 0 then m.p1 else m.p2 end as player_id,
    vi.match_id, vi.leg_no, vi.score, vi.darts, vi.darts_at_double, vi.bust, vi.is_checkout,
    row_number() over (partition by vi.match_id, vi.leg_no, vi.player order by vi.seq) as visit_in_leg
  from public.visits vi
  join public.matches m on m.id = vi.match_id
  where m.status = 'done'
),
won_legs as (
  select tournament_id, player_id, match_id, leg_no, sum(darts) as leg_darts
  from v
  group by tournament_id, player_id, match_id, leg_no
  having bool_or(is_checkout)
)
select
  v.tournament_id,
  v.player_id,
  sum(case when v.bust then 0 else v.score end)                                  as points,
  sum(v.darts)                                                                   as darts,
  sum(case when v.visit_in_leg <= 3 and not v.bust then v.score else 0 end)      as first9_points,
  sum(case when v.visit_in_leg <= 3 then v.darts else 0 end)                     as first9_darts,
  count(*) filter (where not v.bust and v.score = 180)                           as t180,
  count(*) filter (where not v.bust and v.score between 140 and 179)             as t140,
  count(*) filter (where not v.bust and v.score between 100 and 139)             as t100,
  coalesce(max(v.score) filter (where v.is_checkout), 0)                         as highest_checkout,
  count(*) filter (where v.is_checkout)                                          as checkouts,
  sum(v.darts_at_double)                                                         as darts_at_double,
  (select min(w.leg_darts) from won_legs w
    where w.tournament_id = v.tournament_id and w.player_id = v.player_id)       as best_leg_darts
from v
group by v.tournament_id, v.player_id;

create or replace view public.player_tournament_record
with (security_invoker = true) as
select tournament_id, player_id,
       count(*)                                  as matches,
       count(*) filter (where winner_id = player_id) as matches_won,
       sum(legs_for)                             as legs_won,
       sum(legs_against)                         as legs_lost
from (
  select tournament_id, p1 as player_id, winner_id, legs_p1 as legs_for, legs_p2 as legs_against
  from public.matches where status = 'done' and not is_bye and p1 is not null and p2 is not null
  union all
  select tournament_id, p2, winner_id, legs_p2, legs_p1
  from public.matches where status = 'done' and not is_bye and p1 is not null and p2 is not null
) x
group by tournament_id, player_id;

-- ---------------------------------------------------------------
-- RLS: everyone reads, organizers write
-- ---------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['settings','players','tournaments','tournament_players','matches',
                           'legs','visits','tournament_results','elo_history']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select using (true)', t);
    execute format('create policy "organizers write" on public.%I for all to authenticated
                    using (public.is_organizer()) with check (public.is_organizer())', t);
  end loop;
end $$;

alter table public.organizers enable row level security;
create policy "read own organizer row" on public.organizers
  for select to authenticated using (user_id = auth.uid());
-- Add organizers manually in the SQL editor:
--   insert into public.organizers (user_id) select id from auth.users where email = 'you@example.com';

-- ---------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------
alter publication supabase_realtime add table public.tournaments, public.matches, public.legs, public.visits;
alter table public.visits  replica identity full;   -- so DELETE (undo) events include match_id
alter table public.legs    replica identity full;
alter table public.matches replica identity full;
