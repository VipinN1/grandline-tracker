-- Tags each tournament as 'locals', 'prerelease', 'regional' or 'major',
-- powering the Trophy Cabinet (/trophies/:username): locals and pre-release
-- 1st-places each roll up into their own win counter, regional/major results
-- become individual trophy cards.
alter table public.tournaments
  add column if not exists tier text not null default 'locals'
    check (tier in ('locals', 'prerelease', 'regional', 'major'));

-- One-time backfill for rows logged before this column existed, guessed from
-- player_count. Pre-release events aren't guessable this way (they're small
-- like locals but a different category) — any of those need tagging by hand
-- after the fact. Only run this block once — re-running it will re-guess the
-- tier on any row still sitting at the just-added 'locals' default,
-- overwriting a manual edit that happened to also land on 'locals'.
update public.tournaments
set tier = case
  when player_count >= 100 then 'major'
  when player_count >= 25 then 'regional'
  else 'locals'
end
where tier = 'locals';
