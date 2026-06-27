-- Adds a "Practice" flag to tournaments. Practice (voided) games are still saved
-- and shown in a player's history, but are excluded from every aggregate stat:
-- win rate, bounty, leaderboard, meta, matchup charts, top-8s and best finish.
alter table tournaments
  add column if not exists is_practice boolean not null default false;
