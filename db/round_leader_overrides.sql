-- Lets a player log a different "your leader" for an individual round (e.g. a
-- deck swap mid-locals). NULL means "same as the tournament's main leader".
alter table tournament_rounds
  add column if not exists leader_id text,
  add column if not exists leader_name text,
  add column if not exists leader_color text;

alter table live_rounds
  add column if not exists leader_id text,
  add column if not exists leader_name text,
  add column if not exists leader_color text;
