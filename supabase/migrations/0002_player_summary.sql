-- Player list summary: current Elo, total points, tournaments played (SPEC 4.1).
-- Elo = rating after the player's latest match in Elo replay order
-- (tournament date, then finished_at), else the configured start rating.

create or replace view public.player_summary
with (security_invoker = true) as
select
  p.id,
  p.name,
  p.nickname,
  p.active,
  p.created_at,
  coalesce(
    e.rating_after,
    (select (s.data ->> 'eloStart')::numeric from public.settings s where s.id = 1),
    1500
  )::numeric(7,2)                                   as elo,
  coalesce(r.points, 0)::int                        as points,
  coalesce(r.tournaments, 0)::int                   as tournaments,
  exists (
    select 1 from public.tournament_players tp where tp.player_id = p.id
  )                                                 as has_entries
from public.players p
left join lateral (
  select h.rating_after
  from public.elo_history h
  join public.tournaments t on t.id = h.tournament_id
  where h.player_id = p.id
  order by t.date desc, h.played_at desc, h.match_id desc
  limit 1
) e on true
left join (
  select player_id, sum(points) as points, count(*) as tournaments
  from public.tournament_results
  group by player_id
) r on r.player_id = p.id;
