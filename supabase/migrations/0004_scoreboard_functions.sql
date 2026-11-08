-- Scoreboard writes (SPEC 4.6, 4.7). Each runs in one transaction under a lock on the match,
-- so two devices on the same match can't interleave. security invoker: RLS still applies.

-- Leg counts on the match follow the checkouts in its visits (live score for lists and TV).
create or replace function private.recount_legs(p_match uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.matches m
  set legs_p1 = (select count(*) from public.visits v where v.match_id = p_match and v.is_checkout and v.player = 0),
      legs_p2 = (select count(*) from public.visits v where v.match_id = p_match and v.is_checkout and v.player = 1),
      updated_at = now()
  where m.id = p_match;
$$;

grant execute on function private.recount_legs(uuid) to authenticated;

-- ---------------------------------------------------------------
-- Start a match on a board: pending → live, leg 1 with the bull-up winner throwing first.
-- ---------------------------------------------------------------
create or replace function public.start_match(p_match uuid, p_board int, p_first int)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  m record;
  t record;
begin
  perform private.assert_organizer();

  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'not_found'; end if;
  -- Lock the tournament so two boards can't start clashing matches at once.
  select * into t from public.tournaments where id = m.tournament_id for update;

  if t.status = 'done' then raise exception 'tournament_done'; end if;
  if m.stage = 'group' and t.status <> 'groups' then raise exception 'groups_closed'; end if;
  if m.status <> 'pending' then raise exception 'match_not_pending'; end if;
  if m.is_bye or m.p1 is null or m.p2 is null then raise exception 'match_not_ready'; end if;
  if p_board is null or p_board < 1 or p_board > t.boards then raise exception 'bad_board'; end if;
  if p_first is null or p_first not in (0, 1) then raise exception 'bad_starter'; end if;
  if exists (
    select 1 from public.matches
    where tournament_id = t.id and status = 'live' and board = p_board
  ) then
    raise exception 'board_busy';
  end if;
  if exists (
    select 1 from public.matches
    where tournament_id = t.id and status = 'live'
      and (p1 in (m.p1, m.p2) or p2 in (m.p1, m.p2))
  ) then
    raise exception 'player_busy';
  end if;

  update public.matches
  set status = 'live', board = p_board, started_at = now(),
      legs_p1 = 0, legs_p2 = 0, winner_id = null, updated_at = now()
  where id = p_match;

  insert into public.legs (match_id, leg_no, starter)
  values (p_match, 1, p_first)
  on conflict (match_id, leg_no) do update set starter = excluded.starter, winner = null;
end;
$$;

-- ---------------------------------------------------------------
-- One visit. The (match, leg, seq) unique key rejects a double entry.
-- ---------------------------------------------------------------
create or replace function public.record_visit(
  p_match uuid,
  p_leg_no int,
  p_seq int,
  p_player int,
  p_score int,
  p_darts int,
  p_darts_at_double int,
  p_bust boolean,
  p_is_checkout boolean,
  p_starter int
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  st text;
begin
  perform private.assert_organizer();

  select status into st from public.matches where id = p_match for update;
  if not found then raise exception 'not_found'; end if;
  if st <> 'live' then raise exception 'match_not_live'; end if;

  insert into public.legs (match_id, leg_no, starter)
  values (p_match, p_leg_no, p_starter)
  on conflict (match_id, leg_no) do nothing;

  insert into public.visits
    (match_id, leg_no, seq, player, score, darts, darts_at_double, bust, is_checkout)
  values
    (p_match, p_leg_no, p_seq, p_player, p_score, p_darts, p_darts_at_double, p_bust, p_is_checkout);

  if p_is_checkout then
    update public.legs set winner = p_player where match_id = p_match and leg_no = p_leg_no;
    perform private.recount_legs(p_match);
  end if;
end;
$$;

-- ---------------------------------------------------------------
-- Undo: removes the given visit only if it is the match's last one (reopens a finished leg).
-- Already gone → nothing to do, so a retried undo is harmless.
-- ---------------------------------------------------------------
create or replace function public.undo_visit(p_match uuid, p_leg_no int, p_seq int)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  st text;
begin
  perform private.assert_organizer();

  select status into st from public.matches where id = p_match for update;
  if not found then raise exception 'not_found'; end if;
  if st <> 'live' then raise exception 'match_not_live'; end if;
  if exists (
    select 1 from public.visits
    where match_id = p_match
      and (leg_no > p_leg_no or (leg_no = p_leg_no and seq > p_seq))
  ) then
    raise exception 'not_last';
  end if;

  delete from public.visits where match_id = p_match and leg_no = p_leg_no and seq = p_seq;

  update public.legs
  set winner = (
    select v.player from public.visits v
    where v.match_id = p_match and v.leg_no = p_leg_no and v.is_checkout
    limit 1
  )
  where match_id = p_match and leg_no = p_leg_no;

  -- Also touches matches.updated_at, which other devices use as the change signal.
  perform private.recount_legs(p_match);
end;
$$;

-- ---------------------------------------------------------------
-- Confirm result: winner from the visits, advancement (p_slots as in apply_match_result),
-- board freed.
-- ---------------------------------------------------------------
create or replace function public.confirm_match(p_match uuid, p_slots jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  m record;
  t record;
  l1 int;
  l2 int;
  need int;
  w uuid;
  s jsonb;
  target uuid;
begin
  perform private.assert_organizer();

  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'not_found'; end if;
  select * into t from public.tournaments where id = m.tournament_id for update;
  if m.status <> 'live' then raise exception 'match_not_live'; end if;
  if t.status = 'done' then raise exception 'tournament_done'; end if;

  select count(*) filter (where player = 0), count(*) filter (where player = 1)
  into l1, l2
  from public.visits where match_id = p_match and is_checkout;
  need := ceil(m.best_of / 2.0);
  if l1 = need and l2 < need then w := m.p1;
  elsif l2 = need and l1 < need then w := m.p2;
  else raise exception 'match_unfinished';
  end if;

  for s in select * from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb)) loop
    if (s ->> 'player_id')::uuid is distinct from m.p1 and (s ->> 'player_id')::uuid is distinct from m.p2 then
      raise exception 'bad_winner';
    end if;
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
  set status = 'done', winner_id = w, legs_p1 = l1, legs_p2 = l2,
      finished_at = now(), board = null, is_manual = false, updated_at = now()
  where id = p_match;
  return w;
end;
$$;

-- ---------------------------------------------------------------
-- Abandon: back to pending, all visits and legs removed.
-- ---------------------------------------------------------------
create or replace function public.abandon_match(p_match uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  st text;
begin
  perform private.assert_organizer();

  select status into st from public.matches where id = p_match for update;
  if not found then raise exception 'not_found'; end if;
  if st <> 'live' then raise exception 'match_not_live'; end if;

  delete from public.visits where match_id = p_match;
  delete from public.legs where match_id = p_match;
  update public.matches
  set status = 'pending', board = null, started_at = null,
      legs_p1 = 0, legs_p2 = 0, winner_id = null, updated_at = now()
  where id = p_match;
end;
$$;
