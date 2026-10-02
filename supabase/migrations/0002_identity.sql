-- ============================================================
-- 0002 · Identity (plan §3, §28.1, tracker R1.2).
--
-- Who someone is, kept apart from what they may do in a clinic (that is
-- their membership, 0003). A profile belongs to one Supabase Auth user and
-- goes with it.
--
-- - `email` and `phone` are each unique (D39): either one signs in. The phone
--   is stored as +91 E.164 (src/lib/phone.ts); an invited member has none
--   until they accept (plan §8.5).
-- - `platform_role` is DEV or nothing (plan §3.2). It lives here, never in
--   Supabase's user metadata, which users can edit themselves (Brio BUG-17),
--   and it is set from the Supabase dashboard, never by signing up.
-- - `email_link_sent_at`: when the last confirmation or password-reset email
--   went, so neither can be asked for over and over to fill someone's inbox
--   (EMAIL_LINK_COOLDOWN_SECONDS).
--
-- Profiles are written by the server only (registration, the account routes),
-- through the service role; a signed-in user reads their own here and their
-- teammates' through 0003.
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (public.is_clean_line(full_name, 100)),
  email extensions.citext not null unique check (public.is_email(email::text)),
  phone text unique check (public.is_indian_mobile(phone)),
  platform_role text check (platform_role in ('DEV')),
  email_link_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

grant select on public.profiles to authenticated;

-- ------------------------------------------------------------
-- Whether the caller is the platform admin (plan §27.2). Security definer so
-- a policy or function can ask without the caller reading profiles itself.
-- ------------------------------------------------------------

create or replace function public.is_platform_dev()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and platform_role = 'DEV'
  );
$$;

revoke all on function public.is_platform_dev() from public, anon;
grant execute on function public.is_platform_dev() to authenticated, service_role;
