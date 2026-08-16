-- Allows a round to be logged as a bye (no opponent pairing that round).
-- Widens the existing result CHECK constraints on tournament_rounds and
-- live_rounds to accept 'bye' alongside the existing values.
--
-- The constraint name isn't assumed here (Postgres auto-names inline CHECKs,
-- and the exact name can vary) — this looks up whatever CHECK constraint is
-- actually attached to each table's `result` column and drops that.

do $$
declare
  con record;
begin
  for con in
    select c.conname, c.conrelid::regclass::text as tbl
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'c'
      and c.conrelid in ('tournament_rounds'::regclass, 'live_rounds'::regclass)
      and a.attname = 'result'
  loop
    execute format('alter table %s drop constraint %I', con.tbl, con.conname);
  end loop;
end $$;

alter table tournament_rounds
  add constraint tournament_rounds_result_check
  check (result = any (array['win'::text, 'loss'::text, 'bye'::text]));

alter table live_rounds
  add constraint live_rounds_result_check
  check (result = any (array['win'::text, 'loss'::text, 'draw'::text, 'bye'::text]));
