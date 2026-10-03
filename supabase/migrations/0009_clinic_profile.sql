-- ============================================================
-- 0009 · The clinic's profile and its logo (plan §9, §28.8; tracker R3.1,
-- D77 – D79).
--
-- 1. The details, the paper size (D28) and when the consultation fee is
--    collected (D44) are changed by whoever holds `settings.manage`, while the
--    clinic can write, through update_clinic_profile. `clinics` stays
--    SELECT-only for members, so its counters and deletion columns are never
--    written directly (plan §27.4).
-- 2. The logo, the only file a user uploads (AGENTS.md §20): one at a time,
--    its reference on the clinic and its file in the private bucket
--    `clinic-logos` at `clinics/{clinic id}/logo/{logo id}`. A new logo is
--    stored first, then the clinic points at it (set_clinic_logo), and only
--    then is the old file removed; removing the logo (D79) clears the
--    reference first (clear_clinic_logo). Each hands back the file it let go,
--    for the server to remove.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The logo reference
-- ------------------------------------------------------------

alter table public.clinics add column logo_path text;

-- Only inside this clinic's own folder, so a reference can never point at
-- another clinic's file.
alter table public.clinics add constraint clinics_logo_path_shape check (
  logo_path is null
  or logo_path ~ ('^clinics/' || id::text || '/logo/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
);

-- ------------------------------------------------------------
-- 2. Changing the profile
-- ------------------------------------------------------------

-- What each change below calls first: the caller's clinic, refused without
-- settings.manage (AUTH_PERMISSION_DENIED) or while it is view-only
-- (CLINIC_PLAN_EXPIRED).
create or replace function public.require_clinic_settings()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
begin
  if clinic is null or not public.has_permission('settings.manage') then
    raise exception 'Changing the clinic needs settings.manage' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  return clinic;
end;
$$;

-- Only the fields named in `p_changes` change; a field given as null is
-- cleared (the phone, the email, the GSTIN). Each column's CHECK is the last
-- word on its value.
create or replace function public.update_clinic_profile(p_changes jsonb)
returns setof public.clinics
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.require_clinic_settings();
begin
  return query
  with updated as (
    update public.clinics as c
       set name = case when p_changes ? 'name' then p_changes ->> 'name' else c.name end,
           clinic_type = case when p_changes ? 'clinic_type' then p_changes ->> 'clinic_type' else c.clinic_type end,
           phone = case when p_changes ? 'phone' then p_changes ->> 'phone' else c.phone end,
           email = case when p_changes ? 'email' then (p_changes ->> 'email')::extensions.citext else c.email end,
           address = case when p_changes ? 'address' then p_changes ->> 'address' else c.address end,
           city = case when p_changes ? 'city' then p_changes ->> 'city' else c.city end,
           gstin = case when p_changes ? 'gstin' then p_changes ->> 'gstin' else c.gstin end,
           paper_size = case when p_changes ? 'paper_size' then p_changes ->> 'paper_size' else c.paper_size end,
           fee_timing = case when p_changes ? 'fee_timing' then p_changes ->> 'fee_timing' else c.fee_timing end
     where c.id = clinic
    returning c.*
  )
  select * from updated;
end;
$$;

-- Points the clinic at its new logo, whose file must already be stored, and
-- hands back the one it replaced.
create or replace function public.set_clinic_logo(p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.require_clinic_settings();
  previous text;
begin
  if not exists (
    select 1 from storage.objects as o
     where o.bucket_id = 'clinic-logos' and o.name = p_path
  ) then
    raise exception 'The logo file is not stored' using hint = 'LOGO_UPLOAD_FAILED';
  end if;

  select c.logo_path into previous from public.clinics as c where c.id = clinic for update;
  update public.clinics set logo_path = p_path where id = clinic;
  return previous;
end;
$$;

-- Leaves the clinic with no logo (D79), and hands back the one it had.
create or replace function public.clear_clinic_logo()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.require_clinic_settings();
  previous text;
begin
  select c.logo_path into previous from public.clinics as c where c.id = clinic for update;
  update public.clinics set logo_path = null where id = clinic;
  return previous;
end;
$$;

revoke all on function public.require_clinic_settings() from public, anon, authenticated;
revoke all on function public.update_clinic_profile(jsonb) from public, anon;
revoke all on function public.set_clinic_logo(text) from public, anon;
revoke all on function public.clear_clinic_logo() from public, anon;
grant execute on function public.update_clinic_profile(jsonb) to authenticated;
grant execute on function public.set_clinic_logo(text) to authenticated;
grant execute on function public.clear_clinic_logo() to authenticated;

-- ------------------------------------------------------------
-- 3. The logo bucket (plan §28.8)
-- ------------------------------------------------------------

-- Private: a logo is read through /api/clinic/logo, never by a storage URL.
-- The limits repeat the server's own (src/constants/uploads.ts): 500 KB, and
-- PNG, JPEG or WebP.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clinic-logos', 'clinic-logos', false, 512000, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Every member reads their own clinic's folder (the logo heads the app and
-- every document); only settings.manage stores or removes a file there, and
-- stores one only while the clinic can write. There is no UPDATE: a new logo
-- is always a new file, never an overwrite.
create policy clinic_logos_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'clinic-logos'
  and (storage.foldername(name))[1] = 'clinics'
  and (storage.foldername(name))[2] = (select public.current_clinic_id())::text
);

create policy clinic_logos_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'clinic-logos'
  and (storage.foldername(name))[1] = 'clinics'
  and (storage.foldername(name))[2] = (select public.current_clinic_id())::text
  and (select public.has_permission('settings.manage'))
  and (select public.clinic_can_write())
);

create policy clinic_logos_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'clinic-logos'
  and (storage.foldername(name))[1] = 'clinics'
  and (storage.foldername(name))[2] = (select public.current_clinic_id())::text
  and (select public.has_permission('settings.manage'))
);
