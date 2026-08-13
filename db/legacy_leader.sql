-- Optional representative leader card for the Trophy Wall's "+N before
-- tracking" ghost badges (see db/legacy_results.sql, db/profile_legacy_wins.sql).
-- Purely cosmetic: since there's no per-event data behind a legacy tally (it's
-- just a count), this lets someone pick one leader to stand in for it, shown
-- as that single square's background art the same way a real logged win's
-- leader art is. The tally itself stays one square either way — this doesn't
-- create per-event rows.
alter table public.profiles
  add column if not exists legacy_locals_leader_id text,
  add column if not exists legacy_prerelease_leader_id text;
