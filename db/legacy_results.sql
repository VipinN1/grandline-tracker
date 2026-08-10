-- Extends the Trophy Cabinet's "presettable" past results to every tier:
--  - Pre-Release gets the same simple win-tally pattern already shipped for
--    Locals (see db/profile_legacy_wins.sql).
--  - Regional/Major results show up as individual trophy cards (not just a
--    count), so a backfilled one needs a real placement, e.g. 148th. That's
--    stored as an ordinary `tournaments` row flagged `is_legacy` — no rounds
--    required, and it's excluded from nothing else (it's a real result the
--    player is vouching for, so it does count toward Total Events / Best
--    Finish, same as any other logged tournament).

alter table public.profiles
  add column if not exists legacy_prerelease_wins integer not null default 0
    check (legacy_prerelease_wins >= 0);

alter table public.tournaments
  add column if not exists is_legacy boolean not null default false;

-- No new RLS policy needed for either: profiles.update and tournaments.insert
-- /update/delete already scope to the owner (same policies Log Result and
-- Edit Profile already use).
