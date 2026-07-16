-- Articles: dev logs + community-written TCG articles (deck guides, strategy, etc).
-- Published articles are publicly readable (share links work without an account).
-- Run this in the Supabase SQL editor.

-- ── Dev log authors ──────────────────────────────────────────────────────────
-- Cipin can grant friends the ability to post in the "devlog" category.
-- Cipin is always a dev author (policies below check the username directly).
create table if not exists public.article_devs (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.article_devs enable row level security;

create policy "Anyone signed in can read dev grants"
  on public.article_devs for select
  to authenticated
  using (true);

create policy "Cipin can grant dev access"
  on public.article_devs for insert
  to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and username = 'Cipin'));

create policy "Cipin can revoke dev access"
  on public.article_devs for delete
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and username = 'Cipin'));

-- Helper: is the current user a dev (Cipin or granted)?
create or replace function public.is_article_dev()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and username = 'Cipin')
      or exists (select 1 from public.article_devs where user_id = auth.uid());
$$;

-- ── Articles ─────────────────────────────────────────────────────────────────
create table if not exists public.articles (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz,
  author_id     uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  slug          text not null unique,
  category      text not null default 'other'
                check (category in ('devlog', 'deck_guide', 'strategy', 'tournament_report', 'news', 'other')),
  content       jsonb not null default '{}'::jsonb,  -- TipTap document JSON
  excerpt       text,                                 -- plain-text preview for cards / link sharing
  cover_card_id text,                                 -- card used as the list thumbnail
  status        text not null default 'draft' check (status in ('draft', 'published'))
);

create index if not exists articles_published_idx on public.articles (status, published_at desc);
create index if not exists articles_author_idx on public.articles (author_id, updated_at desc);

alter table public.articles enable row level security;

-- Published articles are readable by everyone, including logged-out visitors.
create policy "Anyone can read published articles"
  on public.articles for select
  to anon, authenticated
  using (status = 'published');

-- Authors can read their own drafts.
create policy "Authors can read own articles"
  on public.articles for select
  to authenticated
  using (auth.uid() = author_id);

-- Cipin can read everything (moderation).
create policy "Cipin can read all articles"
  on public.articles for select
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and username = 'Cipin'));

-- Any signed-in user can create articles; the devlog category is dev-only.
create policy "Users can create articles"
  on public.articles for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and (category <> 'devlog' or public.is_article_dev())
  );

create policy "Authors can update own articles"
  on public.articles for update
  to authenticated
  using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id
    and (category <> 'devlog' or public.is_article_dev())
  );

-- Cipin can update any article (e.g. unpublish).
create policy "Cipin can update all articles"
  on public.articles for update
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and username = 'Cipin'))
  with check (true);

create policy "Authors can delete own articles"
  on public.articles for delete
  to authenticated
  using (auth.uid() = author_id);

create policy "Cipin can delete any article"
  on public.articles for delete
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and username = 'Cipin'));

-- ── Likes ────────────────────────────────────────────────────────────────────
create table if not exists public.article_likes (
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);

create index if not exists article_likes_article_idx on public.article_likes (article_id);

alter table public.article_likes enable row level security;

-- Counts are visible to everyone (reader page works logged out).
create policy "Anyone can read likes"
  on public.article_likes for select
  to anon, authenticated
  using (true);

create policy "Users can like articles"
  on public.article_likes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.articles a where a.id = article_id and a.status = 'published')
  );

create policy "Users can unlike articles"
  on public.article_likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── Comments ─────────────────────────────────────────────────────────────────
create table if not exists public.article_comments (
  id         uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists article_comments_article_idx on public.article_comments (article_id, created_at);

alter table public.article_comments enable row level security;

create policy "Anyone can read comments"
  on public.article_comments for select
  to anon, authenticated
  using (true);

create policy "Users can comment on published articles"
  on public.article_comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.articles a where a.id = article_id and a.status = 'published')
  );

create policy "Users can delete own comments"
  on public.article_comments for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Article authors can delete comments on their articles"
  on public.article_comments for delete
  to authenticated
  using (exists (select 1 from public.articles a where a.id = article_id and a.author_id = auth.uid()));

create policy "Cipin can delete any comment"
  on public.article_comments for delete
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and username = 'Cipin'));

-- ── Reporting ────────────────────────────────────────────────────────────────
-- Allow articles and article comments in the existing content_reports table.
alter table public.content_reports drop constraint if exists content_reports_content_type_check;
alter table public.content_reports
  add constraint content_reports_content_type_check
  check (content_type in ('post', 'comment', 'article', 'article_comment'));
