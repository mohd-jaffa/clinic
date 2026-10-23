-- ============================================================
-- 0032 · A bill's doctor, and what Send bill on WhatsApp needs (plan
-- §15.2, §18, §22.1; tracker R8.8, D326, D327, D341, D342).
--
-- bill_start as 0030's, and three things more:
--
--   a patient's bill — not from a visit or an arrival — starts on their
--   assigned doctor while that doctor practises, or on none (D326);
--   it lists the clinic's active doctors with their own consultation fees,
--   for its doctor chips (D342) — the fee prices a Consultation line (D289);
--   the patient's mobile, for the bill sent on WhatsApp from the issued
--   card (D327, D341).
--
-- create_bill (0029) already takes the doctor picked, checked active; a
-- visit's or an arrival's bill keeps its own. One call; every read is on an
-- index leading with clinic_id.
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
  -- A patient's bill starts on their assigned doctor, while they practise (D326, D342).
  if p_patient_id is not null then
    doctor := found_patient.assigned_doctor_id;
  end if;

  return jsonb_build_object(
    'patient', jsonb_build_object(
      'id', found_patient.id,
      'full_name', found_patient.full_name,
      'patient_number', found_patient.patient_number,
      'date_of_birth', found_patient.date_of_birth,
      'gender', found_patient.gender,
      'phone', found_patient.phone,
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
       where bill_doctor.id = doctor
         and bill_doctor.clinic_id = clinic
         and (p_patient_id is null or (bill_doctor.active and member.status = 'ACTIVE'))
    ),
    'doctors', case when p_patient_id is not null then coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', active_doctor.id,
               'full_name', profile.full_name,
               'fee_paise', active_doctor.consultation_fee_paise
             ) order by profile.full_name, active_doctor.id)
        from public.doctors as active_doctor
        join public.clinic_members as member on member.id = active_doctor.member_id
        left join public.profiles as profile on profile.id = member.user_id
       where active_doctor.clinic_id = clinic and active_doctor.active and member.status = 'ACTIVE'
    ), '[]'::jsonb) else '[]'::jsonb end,
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
