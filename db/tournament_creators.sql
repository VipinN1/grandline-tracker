-- Tournament creator grants: Cipin can allow specific users to create
-- their own tournaments from the Tournaments page.
-- Run this in the Supabase SQL editor.

create table if not exists public.tournament_creators (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.tournament_creators enable row level security;

-- Everyone signed in can read grants (the Tournaments page checks the
-- current user's own grant; the Friends page shows toggle state).
create policy "Authenticated users can read creator grants"
  on public.tournament_creators for select
  to authenticated
  using (true);

-- Only the Cipin account can grant.
create policy "Cipin can grant creator access"
  on public.tournament_creators for insert
  to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and username = 'Cipin'));

-- Only the Cipin account can revoke.
create policy "Cipin can revoke creator access"
  on public.tournament_creators for delete
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and username = 'Cipin'));
