-- ============================================================
-- 0030 · Where a new bill starts (plan §15.2, §11.3, §28.7; tracker R8.3,
-- D285, D302 – D313).
--
-- bill_start: what the new bill screen and Collect fee start from, for
-- whoever may issue a bill (payments.create) — a visit, an arrival or a
-- patient, within the doctor scope (D3). Reception bills a visit it may not
-- open (its preset holds no visits.view), so the visit's patient, doctor,
-- fee and the treatments worked on in it are read here, as billing needs
-- them, rather than through the visits' policies:
--
--   the patient, and whether they are archived (nothing is issued then);
--   the visit, or the arrival — its status and token;
--   the doctor, with their own consultation fee (D26);
--   whether a consultation is already billed for the visit or its arrival
--   (the fee at arrival, or an earlier bill of the visit — D286), so it is
--   not suggested twice;
--   the treatments worked on in the visit (a session recorded in it) not
--   yet on a bill for it, oldest first (D285, D308);
--   the patient's balance (D295), for the balance after;
--   from a patient, their oldest visit still to bill (D313).
--
-- One call; every read is on an index leading with clinic_id.
-- ============================================================

create or replace function public.bill_start(p_visit_id uuid, p_appointment_id uuid, p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  found_visit public.visits;
  found_appointment public.appointments;
  billed_appointment uuid;
  found_patient public.patients;
  patient uuid;
  doctor uuid;
begin
  if clinic is null or not public.has_permission('payments.create') then
    raise exception 'Starting a bill needs payments.create' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  if num_nonnulls(p_visit_id, p_appointment_id, p_patient_id) <> 1 then
    raise exception 'A bill starts from a visit, an arrival or a patient' using hint = 'VALIDATION_ERROR';
  end if;

  if p_visit_id is not null then
    select * into found_visit from public.visits as visit where visit.id = p_visit_id and visit.clinic_id = clinic;
    patient := found_visit.patient_id;
    doctor := found_visit.doctor_id;
    billed_appointment := found_visit.appointment_id;
  elsif p_appointment_id is not null then
    select * into found_appointment
      from public.appointments as appointment
     where appointment.id = p_appointment_id and appointment.clinic_id = clinic;
    patient := found_appointment.patient_id;
    doctor := found_appointment.doctor_id;
    billed_appointment := found_appointment.id;
  else
    patient := p_patient_id;
  end if;

  select * into found_patient
    from public.patients as candidate
   where candidate.id = patient and candidate.clinic_id = clinic;
  if found_patient.id is null or not public.can_see_patient(found_patient.id) then
    raise exception 'No such record' using hint = 'RECORD_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'patient', jsonb_build_object(
      'id', found_patient.id,
      'full_name', found_patient.full_name,
      'patient_number', found_patient.patient_number,
      'date_of_birth', found_patient.date_of_birth,
      'gender', found_patient.gender,
      'archived', found_patient.archived_at is not null
    ),
    'visit', case when found_visit.id is not null then jsonb_build_object(
      'id', found_visit.id,
      'visit_date', found_visit.visit_date,
      'status', found_visit.status,
      'billing_status', found_visit.billing_status
    ) end,
    'appointment', case when found_appointment.id is not null then jsonb_build_object(
      'id', found_appointment.id,
      'status', found_appointment.status,
      'token_number', found_appointment.token_number
    ) end,
    'doctor', (
      select jsonb_build_object(
        'id', bill_doctor.id,
        'full_name', profile.full_name,
        'fee_paise', bill_doctor.consultation_fee_paise
      )
        from public.doctors as bill_doctor
        join public.clinic_members as member on member.id = bill_doctor.member_id
        left join public.profiles as profile on profile.id = member.user_id
       where bill_doctor.id = doctor and bill_doctor.clinic_id = clinic
    ),
    'consultation_billed', exists (
      select 1
        from public.bills as bill
        join public.bill_items as item on item.bill_id = bill.id
        join public.services as service on service.id = item.service_id
       where bill.clinic_id = clinic
         and bill.status = 'ISSUED'
         and (bill.visit_id = found_visit.id or bill.appointment_id = billed_appointment)
         and service.category = 'CONSULTATION'
    ),
    'treatments', coalesce((
      select jsonb_agg(jsonb_build_object('id', treatment.id, 'name', treatment.name)
                       order by treatment.created_at, treatment.id)
        from public.treatment_sessions as session
        join public.treatments as treatment on treatment.id = session.treatment_id
       where session.clinic_id = clinic
         and session.visit_id = found_visit.id
         and not exists (
           select 1
             from public.bill_items as item
             join public.bills as bill on bill.id = item.bill_id
            where item.clinic_id = clinic
              and item.treatment_id = treatment.id
              and bill.status = 'ISSUED'
              and (bill.visit_id = found_visit.id or bill.appointment_id = billed_appointment)
         )
    ), '[]'::jsonb),
    'balance_paise', coalesce((
      select balance.balance_paise from public.patient_balances as balance where balance.patient_id = found_patient.id
    ), 0),
    'to_bill', case when p_patient_id is not null then (
      select jsonb_build_object('visit_id', visit.id, 'visit_date', visit.visit_date)
        from public.visits as visit
       where visit.clinic_id = clinic
         and visit.patient_id = found_patient.id
         and visit.billing_status = 'TO_BILL'
       order by visit.visit_date, visit.completed_at
       limit 1
    ) end
  );
end;
$$;

revoke all on function public.bill_start(uuid, uuid, uuid) from public, anon;
grant execute on function public.bill_start(uuid, uuid, uuid) to authenticated;
