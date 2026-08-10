-- Lets a player self-report locals wins that happened before they started
-- logging on PirateTracker (or just never got individually logged). Purely
-- additive to the Trophy Cabinet's Locals Wins tally — it doesn't create
-- tournament rows, so it has no effect on win rate, event counts, or any
-- other stat that's computed from `tournaments`.
alter table public.profiles
  add column if not exists legacy_locals_wins integer not null default 0
    check (legacy_locals_wins >= 0);

-- No new RLS policy needed: profiles already allows a user to update their
-- own row (same policy EditProfileModal's username/bio/pronouns save uses).
