-- "Home Locals" shown on a profile — either a manually picked list of up to
-- 3 stores, or (when empty) computed on the fly as the top 3 stores the
-- player logs locals-tier events at. Stored as a jsonb snapshot
-- ([{ id, name }, ...]) rather than a FK array, matching how tournaments
-- already flatten store info into a `location` string — stays stable even
-- if the underlying store row is later renamed or removed.
alter table profiles
  add column if not exists home_stores jsonb not null default '[]'::jsonb;
