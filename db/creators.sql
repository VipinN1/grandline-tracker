-- Content Creator pages: a public presence page any signed-in user can opt
-- into for themselves (row existence in `creators` = opted in). Hosts
-- external links, a hand-picked selection of their decklists, and a curated
-- list of external content (YouTube/Twitch links) alongside their existing
-- articles/posts.
-- Run this in the Supabase SQL editor.

-- profiles.username is already relied on as unique elsewhere (Friends.jsx
-- looks users up by username) — enforce it defensively since
-- /creators/:username depends on it.
create unique index if not exists profiles_username_unique_idx on public.profiles (username);

create table if not exists public.creators (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  tagline    text,
  links      jsonb not null default '[]'::jsonb,  -- [{ platform: 'youtube', url }, ...]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creators enable row level security;

create policy "Anyone can read creator pages"
  on public.creators for select
  to anon, authenticated
  using (true);

create policy "Users can create their own creator page"
  on public.creators for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own creator page"
  on public.creators for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own creator page"
  on public.creators for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── Featured decklists (hand-picked, ordered) ───────────────────────────────
create table if not exists public.creator_decklists (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.creators(user_id) on delete cascade,
  decklist_id uuid not null references public.decklists(id) on delete cascade,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  unique (creator_id, decklist_id)
);

create index if not exists creator_decklists_creator_idx on public.creator_decklists (creator_id, position);

alter table public.creator_decklists enable row level security;

create policy "Anyone can read featured decklists"
  on public.creator_decklists for select
  to anon, authenticated
  using (true);

create policy "Creators can feature their own decklists"
  on public.creator_decklists for insert
  to authenticated
  with check (
    auth.uid() = creator_id
    and exists (select 1 from public.decklists d where d.id = decklist_id and d.user_id = auth.uid())
  );

create policy "Creators can unfeature their own decklists"
  on public.creator_decklists for delete
  to authenticated
  using (auth.uid() = creator_id);

-- ── Curated content items (YouTube/Twitch links etc.) ───────────────────────
create table if not exists public.creator_content_items (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references public.creators(user_id) on delete cascade,
  title         text not null,
  url           text not null,
  thumbnail_url text,
  description   text,
  platform      text,  -- 'youtube' | 'twitch' | ... — drives an icon only, not enforced
  position      int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists creator_content_items_creator_idx on public.creator_content_items (creator_id, position);

alter table public.creator_content_items enable row level security;

create policy "Anyone can read content items"
  on public.creator_content_items for select
  to anon, authenticated
  using (true);

create policy "Creators can add their own content items"
  on public.creator_content_items for insert
  to authenticated
  with check (auth.uid() = creator_id);

create policy "Creators can update their own content items"
  on public.creator_content_items for update
  to authenticated
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

create policy "Creators can delete their own content items"
  on public.creator_content_items for delete
  to authenticated
  using (auth.uid() = creator_id);
