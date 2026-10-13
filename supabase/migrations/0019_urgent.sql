-- ============================================================
-- 0019 · An urgent patient (plan §11.4, D201; tracker R6.9).
--
-- 1. `appointments.urgent_at`: a waiting patient marked Urgent, and since
--    when. A tag for the desk and the doctor, nothing more: Next patient
--    still takes the lowest token, and Send in works on anyone.
--    Marked only while they wait; it stays through their visit and on the
--    record once they are done. An appointment that leaves the queue
--    instead — back to booked, cancelled, a no-show — drops it.
-- 2. mark_urgent: Urgent, or not, for `appointments.edit` while the clinic
--    can write. Marked while waiting; taken off while waiting or in. Under
--    the doctor's queue lock, as every move is. Hands back when, and when
--    before, for the audit row.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Urgent (D201)
-- ------------------------------------------------------------

alter table public.appointments add column urgent_at timestamptz;
alter table public.appointments
  add constraint appointments_urgent check (urgent_at is null or status in ('ARRIVED', 'IN_PROGRESS', 'COMPLETED'));

-- An appointment that leaves the queue other than through the doctor drops
-- the tag, whichever function moved it.
create or replace function public.clear_urgent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('ARRIVED', 'IN_PROGRESS', 'COMPLETED') then
    new.urgent_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.clear_urgent() from public, anon, authenticated;

create trigger clear_urgent before update of status on public.appointments
for each row execute function public.clear_urgent();

-- ------------------------------------------------------------
-- 2. Marking it (D201)
-- ------------------------------------------------------------

-- Urgent, or not: marked while waiting, taken off while waiting or in.
-- Hands back when, and when before, for the audit row.
create or replace function public.mark_urgent(p_appointment_id uuid, p_urgent boolean)
returns table (urgent_at timestamptz, previously timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.appointments := public.queue_appointment(p_appointment_id);
  stamped timestamptz;
begin
  if p_urgent and was.status <> 'ARRIVED' then
    raise exception 'Only a waiting patient is marked urgent' using hint = 'APPOINTMENT_STATUS_NOT_ALLOWED';
  end if;
  if not p_urgent and was.status not in ('ARRIVED', 'IN_PROGRESS') then
    raise exception 'Only a patient waiting or in is no longer urgent' using hint = 'APPOINTMENT_STATUS_NOT_ALLOWED';
  end if;
  stamped := case when p_urgent then coalesce(was.urgent_at, now()) end;
  update public.appointments as appointment
     set urgent_at = stamped
   where appointment.id = was.id;
  return query select stamped, was.urgent_at;
end;
$$;

revoke all on function public.mark_urgent(uuid, boolean) from public, anon;
grant execute on function public.mark_urgent(uuid, boolean) to authenticated;
