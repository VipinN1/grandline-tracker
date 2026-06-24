-- Direct messages (DMs) between users. Run this in the Supabase SQL editor.

create table if not exists public.direct_messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  sender_id   uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  body        text,
  image_url   text,
  decklist_id uuid references public.decklists(id) on delete set null,
  read        boolean not null default false
);

create index if not exists direct_messages_pair_idx on public.direct_messages (sender_id, receiver_id, created_at);
create index if not exists direct_messages_receiver_idx on public.direct_messages (receiver_id, read);

alter table public.direct_messages enable row level security;

-- Read messages you sent or received.
create policy "read own dms" on public.direct_messages
  for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Send messages as yourself.
create policy "send dms" on public.direct_messages
  for insert to authenticated
  with check (auth.uid() = sender_id);

-- Mark messages you received as read.
create policy "update received dms" on public.direct_messages
  for update to authenticated
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- Enable realtime so new DMs arrive without a page reload.
alter publication supabase_realtime add table public.direct_messages;

-- Images are uploaded to the existing "card-photos" storage bucket under a
-- "dm/<user_id>/..." prefix, so no new bucket/policies are required.
