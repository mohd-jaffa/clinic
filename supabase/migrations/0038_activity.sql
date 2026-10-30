-- ============================================================
-- 0038 · The owner's activity log (plan §19; tracker R11.6; D387 – D390).
--
-- The clinic's audit trail, as its owner reads it: who did what, when, the
-- latest first, a page at a time, kept to one person, one kind of record, or
-- both. The trail holds no names (plan §27.6), so each page is read with
-- what its rows point at, as it is now:
--
-- - the patient a row is about — by its own record, or the visit, treatment
--   or appointment it hangs from — with their number and name (D387);
-- - the record it names: a bill's number and total, a payment's kind and
--   amount, an expense's category, amount and what it was for, a price-list
--   item's, an appointment type's, a category's or a template's name, a
--   member's name and email;
-- - the doctors, appointment types and expense categories its changes name,
--   so a change reads "Dr Rahul → Dr Priya", not two ids.
--
-- A record deleted since (an empty visit, a session, a closure, an invite
-- revoked) is read from what the row itself kept. Rows written together are
-- stamped one after the other, so they read in the order they happened.
-- ============================================================

-- The rows of one change, written together — an appointment and its visit, a
-- sitting that starts and completes its treatment — are stamped as each is
-- written, not with the statement's one now(), so the log reads them in the
-- order they happened.
alter table public.audit_logs alter column created_at set default clock_timestamp();

-- One person's, and one kind's, the latest first.
create index audit_logs_clinic_actor_idx on public.audit_logs (clinic_id, actor_id, created_at desc);
create index audit_logs_clinic_entity_idx on public.audit_logs (clinic_id, entity_type, created_at desc);

-- ------------------------------------------------------------
-- clinic_activity(person, kinds, offset, limit)
--
-- Read as the clinic's owner who asks — security definer, the owner checked
-- inside, the caller's own clinic — so the patient and the record come with
-- each row in the one call. It writes nothing: a view-only clinic reads it.
-- ------------------------------------------------------------

create or replace function public.clinic_activity(
  p_actor uuid,
  p_entity_types text[],
  p_offset integer,
  p_limit integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
begin
  if clinic is null or not public.is_clinic_owner() then
    raise exception 'The activity log is the owner''s' using hint = 'AUTH_PERMISSION_DENIED';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', page.id,
          'action', page.action,
          'entity_type', page.entity_type,
          'entity_id', page.entity_id,
          'changes', page.changes,
          'created_at', page.created_at,
          'actor_name', actor.full_name,
          'patient', case when patient.id is null then null else jsonb_build_object(
            'id', patient.id, 'number', patient.patient_number, 'name', patient.full_name
          ) end,
          'record', subject.record,
          'names', coalesce(lookup.names, '{}'::jsonb)
        )
        order by page.created_at desc, page.id desc
      )
      from (
        select entry.*
          from public.audit_logs as entry
         where entry.clinic_id = clinic
           and (p_actor is null or entry.actor_id = p_actor)
           and (p_entity_types is null or entry.entity_type = any (p_entity_types))
         order by entry.created_at desc, entry.id desc
        offset p_offset
         limit p_limit
      ) as page
      left join public.profiles as actor on actor.id = page.actor_id
      -- The patient the row is about.
      left join lateral (
        select case page.entity_type
          when 'patients' then page.entity_id
          when 'patient_alerts' then (select item.patient_id from public.patient_alerts as item where item.id = page.entity_id)
          when 'appointments' then (select item.patient_id from public.appointments as item where item.id = page.entity_id)
          when 'visits' then (select item.patient_id from public.visits as item where item.id = page.entity_id)
          when 'vitals' then (select item.patient_id from public.vitals as item where item.id = page.entity_id)
          when 'prescriptions' then (select item.patient_id from public.prescriptions as item where item.id = page.entity_id)
          when 'treatments' then (select item.patient_id from public.treatments as item where item.id = page.entity_id)
          when 'treatment_sessions' then (
            select treatment.patient_id
              from public.treatment_sessions as item
              join public.treatments as treatment on treatment.id = item.treatment_id
             where item.id = page.entity_id
          )
          when 'follow_up_contacts' then (
            select item.patient_id from public.follow_up_contacts as item where item.id = page.entity_id
          )
          when 'bills' then (select item.patient_id from public.bills as item where item.id = page.entity_id)
          when 'payments' then (select item.patient_id from public.payments as item where item.id = page.entity_id)
        end as patient_id
      ) as linked on true
      left join public.patients as patient on patient.id = linked.patient_id and patient.clinic_id = clinic
      -- The record the row names.
      left join lateral (
        select case page.entity_type
          when 'bills' then (
            select jsonb_build_object('bill_number', item.bill_number, 'total_paise', item.total_paise)
              from public.bills as item where item.id = page.entity_id
          )
          when 'payments' then (
            select jsonb_build_object('kind', item.kind, 'amount_paise', item.amount_paise)
              from public.payments as item where item.id = page.entity_id
          )
          when 'expenses' then (
            select jsonb_build_object(
              'category', category.name, 'amount_paise', item.amount_paise, 'description', item.description
            )
              from public.expenses as item
              join public.expense_categories as category on category.id = item.category_id
             where item.id = page.entity_id
          )
          when 'services' then (select jsonb_build_object('name', item.name) from public.services as item where item.id = page.entity_id)
          when 'appointment_types' then (
            select jsonb_build_object('name', item.name) from public.appointment_types as item where item.id = page.entity_id
          )
          when 'expense_categories' then (
            select jsonb_build_object('name', item.name) from public.expense_categories as item where item.id = page.entity_id
          )
          when 'prescription_templates' then (
            select jsonb_build_object('name', item.name) from public.prescription_templates as item where item.id = page.entity_id
          )
          when 'clinic_members' then (
            select jsonb_build_object('name', profile.full_name, 'email', profile.email::text)
              from public.clinic_members as item
              join public.profiles as profile on profile.id = item.user_id
             where item.id = page.entity_id
          )
        end as record
      ) as subject on true
      -- The doctors, appointment types and expense categories its changes name.
      left join lateral (
        select jsonb_object_agg(wanted.id, named.name) as names
          from (
            select distinct named_id.id
              from jsonb_each(coalesce(page.changes, '{}'::jsonb)) as change (key, value)
              cross join lateral (values (change.value ->> 'from'), (change.value ->> 'to')) as named_id (id)
             where change.key in ('doctor_id', 'assigned_doctor_id', 'appointment_type_id', 'category_id')
               and jsonb_typeof(change.value) = 'object'
               and named_id.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          ) as wanted
          cross join lateral (
            select coalesce(
              (
                select profile.full_name
                  from public.doctors as doctor
                  join public.clinic_members as member on member.id = doctor.member_id
                  join public.profiles as profile on profile.id = member.user_id
                 where doctor.id = wanted.id::uuid and doctor.clinic_id = clinic
              ),
              (
                select item.name from public.appointment_types as item
                 where item.id = wanted.id::uuid and item.clinic_id = clinic
              ),
              (
                select item.name from public.expense_categories as item
                 where item.id = wanted.id::uuid and item.clinic_id = clinic
              )
            ) as name
          ) as named
         where named.name is not null
      ) as lookup on true
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.clinic_activity(uuid, text[], integer, integer) from public, anon;
grant execute on function public.clinic_activity(uuid, text[], integer, integer) to authenticated;
