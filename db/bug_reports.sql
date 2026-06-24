-- Bug reports: submitted from the navbar "🐞 Bug" button, viewable only by Cipin.
-- Run this in the Supabase SQL editor.

create table if not exists public.bug_reports (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message    text not null,
  user_id    uuid references auth.users(id) on delete set null,
  username   text,
  page       text,
  status     text not null default 'open'
);

alter table public.bug_reports enable row level security;

-- Anyone (logged in or not) can submit a bug report.
create policy "anyone can submit bug reports"
  on public.bug_reports
  for insert
  to anon, authenticated
  with check (true);

-- Only Cipin can read reports.
create policy "cipin can read bug reports"
  on public.bug_reports
  for select
  to authenticated
  using (auth.uid() in (select id from public.profiles where username = 'Cipin'));

-- Only Cipin can update (mark resolved / reopen).
create policy "cipin can update bug reports"
  on public.bug_reports
  for update
  to authenticated
  using (auth.uid() in (select id from public.profiles where username = 'Cipin'))
  with check (auth.uid() in (select id from public.profiles where username = 'Cipin'));

-- Only Cipin can delete reports.
create policy "cipin can delete bug reports"
  on public.bug_reports
  for delete
  to authenticated
  using (auth.uid() in (select id from public.profiles where username = 'Cipin'));
