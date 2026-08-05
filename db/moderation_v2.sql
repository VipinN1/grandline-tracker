-- Moderation v2: adds an "eject user" (ban) action for admins and lets
-- content_reports represent a blocked user or a reported match-chat message,
-- not just posts/comments. Required for Apple App Store Guideline 1.2.
-- Run this in the Supabase SQL editor AFTER db/moderation.sql.

-- Allow 'user' (filed automatically when someone blocks another user) and
-- 'chat' (match chat messages) report types alongside 'post'/'comment'.
alter table public.content_reports drop constraint if exists content_reports_content_type_check;
alter table public.content_reports add constraint content_reports_content_type_check
  check (content_type in ('post', 'comment', 'user', 'chat'));

-- Ban fields on profiles. A non-null banned_at ejects the user: the app signs
-- them out on their next session check and refuses new sign-ins.
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists ban_reason text;

-- Let a signed-in user read their own banned_at/ban_reason (needed so the app
-- can detect the ban and sign itself out with a clear message).
drop policy if exists "users can read own ban status" on public.profiles;
create policy "users can read own ban status"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Only Cipin can ban/unban (lets Cipin update someone ELSE's profile row,
-- which the normal "users update own profile" policy wouldn't allow).
drop policy if exists "cipin can ban users" on public.profiles;
create policy "cipin can ban users"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() in (select id from public.profiles where username = 'Cipin'))
  with check (auth.uid() in (select id from public.profiles where username = 'Cipin'));

-- Belt-and-suspenders: even though the policy above only lets Cipin touch
-- OTHER users' rows, the existing "users update own profile" policy (if any)
-- still lets a user write any column on their OWN row — including banned_at.
-- This trigger silently discards changes to banned_at/ban_reason from anyone
-- but Cipin, so a banned user can never un-ban themselves via a normal
-- profile edit.
create or replace function public.protect_ban_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (auth.uid() in (select id from public.profiles where username = 'Cipin')) then
    new.banned_at := old.banned_at;
    new.ban_reason := old.ban_reason;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_ban_fields_trigger on public.profiles;
create trigger protect_ban_fields_trigger
  before update on public.profiles
  for each row
  execute function public.protect_ban_fields();
