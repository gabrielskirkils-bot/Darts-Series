-- Transactional writes for tournaments (CLAUDE.md: multi-row changes in one transaction).
-- The draw/bracket is computed in TypeScript (src/lib/domain); these functions check
-- preconditions under a row lock and insert/update everything atomically.
-- security invoker: RLS still applies; the explicit organizer check gives a clear error.

create schema if not exists private;
grant usage on schema private to authenticated;

-- Inserts match rows from a JSON array (shape of MatchPlan, snake_case keys).
create or replace function private.insert_matches(p_tournament uuid, p_matches jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.matches
    (tournament_id, stage, group_index, round, slot, sort_order, p1, p2,
     start_score, best_of, status, winner_id, is_bye, finished_at)
  select
    p_tournament,
    x ->> 'stage',
    (x ->> 'group_index')::int,
    (x ->> 'round')::int,
    (x ->> 'slot')::int,
    (x ->> 'sort_order')::int,
    (x ->> 'p1')::uuid,
    (x ->> 'p2')::uuid,
    (x ->> 'start_score')::int,
    (x ->> 'best_of')::int,
    x ->> 'status',
    (x ->> 'winner_id')::uuid,
    coalesce((x ->> 'is_bye')::boolean, false),
    case when x ->> 'status' = 'done' then now() end
  from jsonb_array_elements(p_matches) as x;
$$;

grant execute on function private.insert_matches(uuid, jsonb) to authenticated;

create or replace function private.assert_organizer()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_organizer() then
    raise exception 'not_organizer' using errcode = '42501';
  end if;
end;
$$;

grant execute on function private.assert_organizer() to authenticated;

-- ---------------------------------------------------------------
-- Create a tournament with its entrants and initial matches.
-- ---------------------------------------------------------------
create or replace function public.create_tournament(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  t_id uuid;
begin
  perform private.assert_organizer();

  insert into public.tournaments
    (name, date, status, format, group_count, advance, third_place, seeding, boards, fmt, ko)
  values (
    p ->> 'name',
    (p ->> 'date')::date,
    p ->> 'status',
    p ->> 'format',
    (p ->> 'group_count')::int,
    (p ->> 'advance')::int,
    (p ->> 'third_place')::boolean,
    p ->> 'seeding',
    (p ->> 'boards')::int,
    p -> 'fmt',
    nullif(p -> 'ko', 'null'::jsonb)
  )
  returning id into t_id;

  insert into public.tournament_players (tournament_id, player_id, seed, group_index)
  select t_id, (x ->> 'player_id')::uuid, (x ->> 'seed')::int, (x ->> 'group_index')::int
  from jsonb_array_elements(p -> 'players') as x;

  perform private.insert_matches(t_id, p -> 'matches');
  return t_id;
end;
$$;

-- ---------------------------------------------------------------
-- Redraw groups while no group match has started.
-- ---------------------------------------------------------------
create or replace function public.redraw_groups(p_tournament uuid, p jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  t record;
begin
  perform private.assert_organizer();

  select * into t from public.tournaments where id = p_tournament for update;
  if not found then raise exception 'not_found'; end if;
  if t.status <> 'groups' then raise exception 'groups_closed'; end if;
  if exists (
    select 1 from public.matches
    where tournament_id = p_tournament and stage = 'group' and status <> 'pending'
  ) then
    raise exception 'groups_started';
  end if;

  delete from public.matches where tournament_id = p_tournament and stage = 'group';

  update public.tournament_players tp
  set seed = (x ->> 'seed')::int,
      group_index = (x ->> 'group_index')::int
  from jsonb_array_elements(p -> 'players') as x
  where tp.tournament_id = p_tournament and tp.player_id = (x ->> 'player_id')::uuid;

  perform private.insert_matches(p_tournament, p -> 'matches');
end;
$$;

-- ---------------------------------------------------------------
-- Start the knockout once every group match is done.
-- ---------------------------------------------------------------
create or replace function public.start_knockout(p_tournament uuid, p jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  t record;
begin
  perform private.assert_organizer();

  select * into t from public.tournaments where id = p_tournament for update;
  if not found then raise exception 'not_found'; end if;
  if t.format <> 'groups_ko' or t.status <> 'groups' then raise exception 'knockout_not_allowed'; end if;
  if exists (
    select 1 from public.matches
    where tournament_id = p_tournament and stage = 'group' and status <> 'done'
  ) then
    raise exception 'groups_unfinished';
  end if;
  if exists (
    select 1 from public.matches where tournament_id = p_tournament and stage <> 'group'
  ) then
    raise exception 'knockout_exists';
  end if;

  perform private.insert_matches(p_tournament, p -> 'matches');
  update public.tournaments set status = 'ko', ko = p -> 'ko' where id = p_tournament;
end;
$$;

-- ---------------------------------------------------------------
-- Fallback result (leg score only) for a pending or manual match, plus knockout
-- advancement. p_slots: [{stage, round, slot, side: "p1"|"p2", player_id}] — every
-- target must still be pending, otherwise nothing changes.
-- ---------------------------------------------------------------
create or replace function public.apply_match_result(
  p_match uuid,
  p_legs_p1 int,
  p_legs_p2 int,
  p_winner uuid,
  p_slots jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  m record;
  t record;
  s jsonb;
  target uuid;
begin
  perform private.assert_organizer();

  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'not_found'; end if;
  select * into t from public.tournaments where id = m.tournament_id for update;

  if m.is_bye then raise exception 'is_bye'; end if;
  if m.status = 'live' then raise exception 'match_live'; end if;
  if m.status = 'done' and not m.is_manual then raise exception 'has_visits'; end if;
  if exists (select 1 from public.visits where match_id = p_match) then raise exception 'has_visits'; end if;
  if p_winner is distinct from m.p1 and p_winner is distinct from m.p2 then raise exception 'bad_winner'; end if;
  if m.stage = 'group' and t.status <> 'groups' then raise exception 'groups_closed'; end if;
  if t.status = 'done' then raise exception 'tournament_done'; end if;

  for s in select * from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb)) loop
    select id into target from public.matches
    where tournament_id = m.tournament_id
      and stage = s ->> 'stage'
      and round = (s ->> 'round')::int
      and slot = (s ->> 'slot')::int
    for update;
    if not found then continue; end if;
    if (select status from public.matches where id = target) <> 'pending' then
      raise exception 'next_match_started';
    end if;
    if s ->> 'side' = 'p1' then
      update public.matches set p1 = (s ->> 'player_id')::uuid, updated_at = now() where id = target;
    else
      update public.matches set p2 = (s ->> 'player_id')::uuid, updated_at = now() where id = target;
    end if;
  end loop;

  update public.matches
  set legs_p1 = p_legs_p1,
      legs_p2 = p_legs_p2,
      winner_id = p_winner,
      status = 'done',
      is_manual = true,
      board = null,
      finished_at = coalesce(finished_at, now()),
      updated_at = now()
  where id = p_match;
end;
$$;
