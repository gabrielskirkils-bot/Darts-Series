-- Finishing tournaments, recalculating results and Elo (SPEC 4.9, 4.11).
-- Places, points and Elo are computed in TypeScript (src/lib/domain); these functions check
-- preconditions under a lock and write everything in one transaction.

-- Elo is always recomputed in full (SPEC 4.11), so the whole history is replaced.
create or replace function private.replace_elo(p_elo jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  -- Every row is rewritten from p_elo below. (A WHERE clause keeps pg-safeupdate happy.)
  delete from public.elo_history where true;
  insert into public.elo_history
    (match_id, player_id, tournament_id, rating_before, rating_after, played_at)
  select
    (x ->> 'match_id')::uuid,
    (x ->> 'player_id')::uuid,
    (x ->> 'tournament_id')::uuid,
    (x ->> 'rating_before')::numeric,
    (x ->> 'rating_after')::numeric,
    (x ->> 'played_at')::timestamptz
  from jsonb_array_elements(coalesce(p_elo, '[]'::jsonb)) as x;
$$;

grant execute on function private.replace_elo(jsonb) to authenticated;

-- ---------------------------------------------------------------
-- Finish (p_finish = true) or recalculate a finished tournament (false):
-- freeze places and points, then replace the Elo history.
-- ---------------------------------------------------------------
create or replace function public.save_results(
  p_tournament uuid,
  p_finish boolean,
  p_results jsonb,
  p_elo jsonb
)
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

  if p_finish then
    if t.status = 'done' then raise exception 'already_finished'; end if;
    if t.format = 'groups_ko' and t.status <> 'ko' then raise exception 'knockout_missing'; end if;
    if exists (
      select 1 from public.matches
      where tournament_id = p_tournament and not is_bye and status <> 'done'
    ) then
      raise exception 'matches_unfinished';
    end if;
  elsif t.status <> 'done' then
    raise exception 'not_finished';
  end if;

  if (select count(*) from jsonb_array_elements(p_results))
     <> (select count(*) from public.tournament_players where tournament_id = p_tournament) then
    raise exception 'results_incomplete';
  end if;

  delete from public.tournament_results where tournament_id = p_tournament;
  insert into public.tournament_results (tournament_id, player_id, place, points)
  select p_tournament, (x ->> 'player_id')::uuid, (x ->> 'place')::int, (x ->> 'points')::int
  from jsonb_array_elements(p_results) as x;

  if p_finish then
    update public.tournaments set status = 'done', finished_at = now() where id = p_tournament;
  end if;

  perform private.replace_elo(p_elo);
end;
$$;

-- ---------------------------------------------------------------
-- Delete a tournament. If it was finished, its matches leave the Elo history,
-- so the recomputed history (without it) replaces the old one.
-- ---------------------------------------------------------------
create or replace function public.delete_tournament(p_tournament uuid, p_elo jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  st text;
begin
  perform private.assert_organizer();

  select status into st from public.tournaments where id = p_tournament for update;
  if not found then raise exception 'not_found'; end if;

  delete from public.tournaments where id = p_tournament;
  if st = 'done' then
    perform private.replace_elo(p_elo);
  end if;
end;
$$;
