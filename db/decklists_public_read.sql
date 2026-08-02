-- Fallback for the shareable decklist pages (/decklists/:id) if they can't
-- load another user's deck. This may already be a no-op: the Community feed
-- already reads other users' `decklists` rows via `posts.decklists(*)` with
-- no owner filter, which only works today if decklists SELECT is already
-- open. Only run this if testing shows the new page returns empty for a
-- deck it doesn't own.
alter table public.decklists enable row level security;

create policy "Anyone can read decklists"
  on public.decklists for select
  to anon, authenticated
  using (true);
