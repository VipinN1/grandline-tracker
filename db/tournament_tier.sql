-- Tags each tournament as 'locals', 'regional' or 'major', powering the
-- Trophy Cabinet (/trophies/:username): locals 1st-places roll up into a win
-- counter, regional/major results become individual trophy cards.
alter table public.tournaments
  add column if not exists tier text not null default 'locals'
    check (tier in ('locals', 'regional', 'major'));

-- One-time backfill for rows logged before this column existed, guessed from
-- player_count. Only run this block once — re-running it will re-guess the
-- tier on any row still sitting at the just-added 'locals' default,
-- overwriting a manual edit that happened to also land on 'locals'.
update public.tournaments
set tier = case
  when player_count >= 100 then 'major'
  when player_count >= 25 then 'regional'
  else 'locals'
end
where tier = 'locals';
