-- Lets a tournament log have more than one attached decklist (e.g. a deck swap
-- during a locals). tournaments.decklist_id stays as a legacy pointer to the
-- first attached deck; this join table is the source of truth going forward.
-- Run this in the Supabase SQL editor.

create table if not exists public.tournament_decklists (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  decklist_id uuid not null references public.decklists(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (tournament_id, decklist_id)
);

create index if not exists tournament_decklists_tournament_idx on public.tournament_decklists (tournament_id);

alter table public.tournament_decklists enable row level security;

create policy "Anyone can read tournament decklist links"
  on public.tournament_decklists for select
  to authenticated
  using (true);

create policy "Owners can attach decklists to their own tournaments"
  on public.tournament_decklists for insert
  to authenticated
  with check (exists (select 1 from public.tournaments t where t.id = tournament_id and t.user_id = auth.uid()));

create policy "Owners can remove decklists from their own tournaments"
  on public.tournament_decklists for delete
  to authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.user_id = auth.uid()));
