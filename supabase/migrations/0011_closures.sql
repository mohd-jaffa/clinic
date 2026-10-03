-- ============================================================
-- 0011 · Holidays and leave (plan §9, §28.2; tracker R3.3, D84 – D87).
--
-- A closure is a run of days the whole clinic is shut (a holiday) or one of
-- its doctors is away (leave), with a reason. Booking will refuse those days
-- (0014). Every member reads them — the calendar shades them, booking checks
-- them; adding one needs `settings.manage` and a clinic that can write
-- (plan §27.4).
--
-- 1. A closure starts today or later, in the clinic's timezone, ends on or
--    after its start, and lasts at most 366 days (D85).
-- 2. Closures for the same people never share a day: two of the whole
--    clinic's, or two of one doctor's (D86). A doctor's leave inside a clinic
--    holiday is allowed — they say different things.
-- 3. A closure is never edited. One not yet over is removed through
--    remove_closure; a past one stays, as a record (D84).
-- ============================================================

-- What a closure's composite foreign key points at, so a doctor's leave can
-- only ever name a doctor of the same clinic.
alter table public.doctors add constraint doctors_id_clinic_unique unique (id, clinic_id);

create table public.clinic_closures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  -- None closes the whole clinic; a doctor is that doctor's leave.
  doctor_id uuid,
  starts_on date not null,
  ends_on date not null,
  reason text not null check (public.is_clean_line(reason, 100)),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint clinic_closures_ends_after_start check (ends_on >= starts_on),
  -- Both ends counted: at most 366 days (MAX_CLOSURE_DAYS).
  constraint clinic_closures_at_most_a_year check (ends_on - starts_on < 366),
  foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id) on delete cascade,
  constraint clinic_closures_clinic_overlap exclude using gist (
    clinic_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  ) where (doctor_id is null),
  constraint clinic_closures_doctor_overlap exclude using gist (
    doctor_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  ) where (doctor_id is not null)
);

create index clinic_closures_clinic_id_idx on public.clinic_closures (clinic_id, starts_on);

-- ------------------------------------------------------------
-- 1. A new closure (D85)
-- ------------------------------------------------------------

-- Starts today or later in the clinic's own timezone, and names who added it,
-- whatever a client sent.
create or replace function public.check_new_closure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.starts_on < public.clinic_today(new.clinic_id) then
    raise exception 'A closure starts today or later' using hint = 'CLOSURE_STARTS_BEFORE_TODAY';
  end if;
  new.created_by = coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;

revoke all on function public.check_new_closure() from public, anon, authenticated;

create trigger check_new_closure before insert on public.clinic_closures
for each row execute function public.check_new_closure();

-- ------------------------------------------------------------
-- 2. Removing one not yet over (D84)
-- ------------------------------------------------------------

-- Hands back the closure removed, for the audit trail. One that is over is
-- refused (CLOSURE_OVER); one that is not the caller's clinic's is not found.
create or replace function public.remove_closure(p_closure_id uuid)
returns setof public.clinic_closures
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.require_clinic_settings();
  closure public.clinic_closures;
begin
  select * into closure from public.clinic_closures as c
   where c.id = p_closure_id and c.clinic_id = clinic
   for update;
  if closure.id is null then
    raise exception 'No such closure' using hint = 'RECORD_NOT_FOUND';
  end if;
  if closure.ends_on < public.clinic_today(clinic) then
    raise exception 'A closure that is over stays as a record' using hint = 'CLOSURE_OVER';
  end if;
  delete from public.clinic_closures as c where c.id = closure.id;
  return next closure;
end;
$$;

revoke all on function public.remove_closure(uuid) from public, anon;
grant execute on function public.remove_closure(uuid) to authenticated;

-- ------------------------------------------------------------
-- Policies (plan §27.4)
-- ------------------------------------------------------------

alter table public.clinic_closures enable row level security;

create policy clinic_closures_select on public.clinic_closures
for select to authenticated
using (clinic_id = (select public.current_clinic_id()));

create policy clinic_closures_insert on public.clinic_closures
for insert to authenticated
with check (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('settings.manage'))
  and (select public.clinic_can_write())
);

-- No UPDATE: a closure is removed and added again. No DELETE: removing one
-- goes through remove_closure, which keeps the past ones.
grant select, insert on public.clinic_closures to authenticated;
