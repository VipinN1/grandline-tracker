-- Moderation: content reports (posts/comments) and user blocking.
-- Required for Apple App Store Guideline 1.2 (user-generated content).
-- Run this in the Supabase SQL editor.

create table if not exists public.content_reports (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  reporter_id      uuid not null references auth.users(id) on delete cascade,
  content_type     text not null check (content_type in ('post', 'comment')),
  content_id       uuid not null,
  content_owner_id uuid,
  reason           text not null,
  details          text,
  status           text not null default 'open'
);

-- One report per user per piece of content.
create unique index if not exists content_reports_unique_idx
  on public.content_reports (reporter_id, content_type, content_id);

create index if not exists content_reports_status_idx
  on public.content_reports (status, created_at);

alter table public.content_reports enable row level security;

-- Any signed-in user can report content (as themselves).
create policy "users can submit reports"
  on public.content_reports
  for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- Only Cipin can read reports.
create policy "cipin can read reports"
  on public.content_reports
  for select
  to authenticated
  using (auth.uid() in (select id from public.profiles where username = 'Cipin'));

-- Only Cipin can update (mark resolved / reopen).
create policy "cipin can update reports"
  on public.content_reports
  for update
  to authenticated
  using (auth.uid() in (select id from public.profiles where username = 'Cipin'))
  with check (auth.uid() in (select id from public.profiles where username = 'Cipin'));

-- Only Cipin can delete reports.
create policy "cipin can delete reports"
  on public.content_reports
  for delete
  to authenticated
  using (auth.uid() in (select id from public.profiles where username = 'Cipin'));

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.blocked_users enable row level security;

-- Users manage only their own block list.
create policy "users can read own blocks"
  on public.blocked_users
  for select
  to authenticated
  using (auth.uid() = blocker_id);

create policy "users can add blocks"
  on public.blocked_users
  for insert
  to authenticated
  with check (auth.uid() = blocker_id);

create policy "users can remove blocks"
  on public.blocked_users
  for delete
  to authenticated
  using (auth.uid() = blocker_id);
