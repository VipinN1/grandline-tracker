-- Corrective migration — run once. Fixes two mismatches found by diffing
-- the live schema dump against what the Trophy Cabinet feature actually
-- writes (db/tournament_tier.sql, db/legacy_results.sql).

-- Fix 1: tournaments.tier's CHECK was created from an earlier version of
-- db/tournament_tier.sql, before Pre-Release existed as its own tier — it
-- currently only allows locals/regional/major. Editing that file afterward
-- doesn't retroactively update an already-created constraint, so any save
-- with tier = 'prerelease' is rejected until this runs.
alter table public.tournaments drop constraint if exists tournaments_tier_check;
alter table public.tournaments add constraint tournaments_tier_check
  check (tier in ('locals', 'prerelease', 'regional', 'major'));

-- Fix 2: legacy Regional/Major trophy entries (tournaments.is_legacy = true,
-- added via "+ Add Past Result" on the Trophy Cabinet) are backfilled with
-- just a placement — no card id is known for leader_id, and leader_name is
-- an optional free-text field that may be left blank. Both columns were
-- NOT NULL, which rejects every legacy-trophy insert until this runs.
alter table public.tournaments alter column leader_id drop not null;
alter table public.tournaments alter column leader_name drop not null;
