import { describe, expect, it } from "vitest";

import { VITAL_LIMITS } from "@/constants/clinical";
import { TEXT_LIMITS } from "@/constants/limits";
import { isErrorMessageCode } from "@/constants/messages";
import { BILLING_STATUSES, NO_CHARGE_REASONS, SEND_IN_CHOICES, VISIT_STATUSES } from "@/constants/statuses";
import {
  betweenBounds,
  checkedValues,
  cleanTextLimit,
  columnLine,
  functionBody,
  quoted,
  readMigration,
  tableBody,
} from "@tests/support/sql";

const sql = readMigration("0018_visits.sql");
const visits = tableBody(sql, "visits");
const vitals = tableBody(sql, "vitals");

/** A policy's whole statement, by its name. */
const policy = (name: string) => new RegExp(`create policy ${name} [\\s\\S]*?;`).exec(sql)![0];

describe("0018 a visit (plan §12.1, §28.5)", () => {
  it("holds the vocabularies the app knows", () => {
    expect(checkedValues(visits, "status")).toEqual([...VISIT_STATUSES]);
    expect(checkedValues(visits, "billing_status")).toEqual([...BILLING_STATUSES]);
    expect(checkedValues(visits, "no_charge_reason")).toEqual([...NO_CHARGE_REASONS]);
    expect(columnLine(sql, "visits", "status")).toContain("default 'OPEN'");
  });

  it("bounds its clinical text as the visit screen will", () => {
    expect(cleanTextLimit(sql, "visits", "complaint")).toBe(TEXT_LIMITS.complaint);
    expect(cleanTextLimit(sql, "visits", "diagnosis")).toBe(TEXT_LIMITS.diagnosis);
    expect(cleanTextLimit(sql, "visits", "notes")).toBe(TEXT_LIMITS.clinicalNotes);
    expect(cleanTextLimit(sql, "visits", "no_charge_note")).toBe(TEXT_LIMITS.reason);
  });

  it("hangs from the clinic, and names only the clinic's own patient, doctor and appointment — one visit each", () => {
    expect(visits).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(visits).toContain("appointment_id uuid unique,");
    expect(visits).toContain("foreign key (patient_id, clinic_id) references public.patients (id, clinic_id),");
    expect(visits).toContain("foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id),");
    expect(visits).toContain("foreign key (appointment_id, clinic_id) references public.appointments (id, clinic_id),");
    expect(visits).toContain("unique (id, clinic_id)");
  });

  it("is closed when it was, with its billing state, and free only with a reason — Other with a note (D46)", () => {
    expect(visits).toContain("(status = 'COMPLETED') = (completed_at is not null)");
    expect(visits).toContain("(status = 'COMPLETED') = (billing_status is not null)");
    expect(visits).toContain("coalesce(billing_status = 'NO_CHARGE', false) = (no_charge_reason is not null)");
    expect(visits).toContain("(no_charge_reason is distinct from 'OTHER' or no_charge_note is not null)");
  });

  it("sets its day in the clinic's timezone, keeps whose it is, never opens again once closed", () => {
    const check = functionBody(sql, "check_visit");
    expect(check).toContain("select (new.started_at at time zone clinic.timezone)::date into new.visit_date");
    expect(check).toContain("new.patient_id <> old.patient_id or new.doctor_id <> old.doctor_id");
    expect(check).toContain("if old.status = 'COMPLETED' and new.status = 'OPEN' then");
    expect(sql).toContain(
      "create trigger check_visit before insert or update on public.visits\nfor each row execute function public.check_visit();",
    );
    expect(sql).toContain(
      "create trigger set_visits_actor before insert or update on public.visits\nfor each row execute function public.set_actor();",
    );
    expect(sql).toContain(
      "create trigger set_visits_updated_at before update on public.visits\nfor each row execute function public.set_updated_at();",
    );
  });

  it("grows the doctor scope with each visit's doctor (plan §27.3)", () => {
    expect(functionBody(sql, "add_visit_doctor")).toContain("on conflict do nothing;");
    expect(sql).toContain(
      "create trigger add_visit_doctor after insert on public.visits\nfor each row execute function public.add_visit_doctor();",
    );
  });
});

describe("0018 vitals (plan §12.2)", () => {
  it("bounds each reading by VITAL_LIMITS", () => {
    expect(betweenBounds(sql, "vitals", "systolic")).toEqual(VITAL_LIMITS.systolic);
    expect(betweenBounds(sql, "vitals", "diastolic")).toEqual(VITAL_LIMITS.diastolic);
    expect(betweenBounds(sql, "vitals", "pulse")).toEqual(VITAL_LIMITS.pulse);
    expect(betweenBounds(sql, "vitals", "temperature_f")).toEqual(VITAL_LIMITS.temperatureF);
    expect(betweenBounds(sql, "vitals", "spo2")).toEqual(VITAL_LIMITS.spo2);
    expect(betweenBounds(sql, "vitals", "respiratory_rate")).toEqual(VITAL_LIMITS.respiratoryRate);
    expect(betweenBounds(sql, "vitals", "weight_kg")).toEqual(VITAL_LIMITS.weightKg);
    expect(betweenBounds(sql, "vitals", "height_cm")).toEqual(VITAL_LIMITS.heightCm);
  });

  it("is one set per visit, of the clinic's own visit and patient, with blood pressure whole and the lower reading lower", () => {
    expect(vitals).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(vitals).toContain("visit_id uuid not null unique,");
    expect(vitals).toContain("foreign key (visit_id, clinic_id) references public.visits (id, clinic_id),");
    expect(vitals).toContain("foreign key (patient_id, clinic_id) references public.patients (id, clinic_id),");
    expect(vitals).toContain("check ((systolic is null) = (diastolic is null) and diastolic < systolic)");
    expect(columnLine(sql, "vitals", "temperature_f")).toContain("numeric(4, 1)");
  });
});

describe("0018 the queue's moves (plan §11.4; D192 – D198)", () => {
  it("holds the doctor's queue before the appointment's row, in every move, so two desks never cross", () => {
    const held = functionBody(sql, "queue_appointment");
    expect(held.indexOf("perform public.hold_doctor(doctor);")).toBeLessThan(
      held.indexOf("public.appointment_for_change(p_appointment_id, 'appointments.edit')"),
    );
    for (const name of ["send_in", "mark_done", "back_to_waiting", "mark_stepped_out"]) {
      expect(functionBody(sql, name), name).toContain("public.queue_appointment(p_appointment_id)");
    }
    const next = functionBody(sql, "next_patient");
    expect(next).toContain("was := public.queue_appointment(p_appointment_id);");
    expect(next).toContain("perform public.hold_doctor(p_doctor_id);");
  });

  it("sends in only a waiting patient, asks what becomes of anyone already in, and changes nothing sent twice (D192)", () => {
    const send = functionBody(sql, "send_in");
    expect(quoted(/p_others not in \(([^)]*)\)/.exec(send)![1])).toEqual([...SEND_IN_CHOICES]);
    expect(send).toContain("if was.status = 'IN_PROGRESS' then");
    expect(send).toContain("if was.status <> 'ARRIVED' then");
    expect(send).toContain("hint = 'DOCTOR_ROOM_TAKEN'");
    expect(send).toContain("exit when p_others = 'KEEP';");
    expect(send).toContain("moves := moves || public.finish_appointment(other);");
    expect(functionBody(sql, "check_sent_in")).toContain("hint = 'PATIENT_ARCHIVED'");
  });

  it("opens a visit going in — or continues the one kept — and closes it as To bill, whatever was recorded (D43, D46)", () => {
    const start = functionBody(sql, "start_appointment");
    expect(start).toContain("set status = 'IN_PROGRESS', started_at = now(), stepped_out_at = null");
    expect(start).toContain("where kept.appointment_id = p_appointment.id and kept.status = 'OPEN';");
    expect(start).toContain("insert into public.visits (clinic_id, patient_id, doctor_id, appointment_id)");
    const finish = functionBody(sql, "finish_appointment");
    expect(finish).toContain("set status = 'COMPLETED', completed_at = now(), billing_status = 'TO_BILL'");
    expect(functionBody(sql, "mark_done")).toContain("if was.status = 'COMPLETED' then");
  });

  it("has Next patient finish only the patient it is for, then send in the lowest waiting token not stepped out (D196, D198)", () => {
    const next = functionBody(sql, "next_patient");
    expect(next).toContain("if was.doctor_id <> p_doctor_id then");
    expect(next).toContain("if was.status = 'COMPLETED' then");
    expect(next).toContain("moves := public.finish_appointment(was);");
    expect(next).toContain("and appointment.stepped_out_at is null");
    expect(next).toContain("order by appointment.token_number, appointment.arrived_at");
    expect(next).toContain("not public.has_permission('appointments.edit')");
    expect(next).toContain("perform public.require_clinic_write(clinic);");
    // With no one named and someone in, it names them and sends no one more.
    expect(next).toContain("return jsonb_build_object('moves', moves, 'sent', public.sent_in(next_one));");
  });

  it("removes an empty visit sent back to waiting, keeps one with anything recorded (D197)", () => {
    const back = functionBody(sql, "back_to_waiting");
    expect(back).toContain("set status = 'ARRIVED', started_at = null");
    expect(back).toContain("if visit is not null and public.visit_is_empty(visit) then");
    const empty = functionBody(sql, "visit_is_empty");
    for (const column of ["complaint", "diagnosis", "notes", "follow_up_on"]) {
      expect(empty).toContain(`visit.${column} is not null`);
    }
    expect(empty).toContain("from public.vitals as vital where vital.visit_id = p_visit_id");
    const change = functionBody(sql, "change_appointment_status");
    expect(change).toContain("hint = 'APPOINTMENT_HAS_VISIT'");
    expect(change).toContain("stepped_out_at = null");
  });

  it("marks a waiting patient stepped out or back, only while waiting, handing back when before (D198)", () => {
    expect(sql).toContain("add column stepped_out_at timestamptz;");
    expect(sql).toContain("check (stepped_out_at is null or status = 'ARRIVED')");
    const stepped = functionBody(sql, "mark_stepped_out");
    expect(stepped).toContain("if was.status <> 'ARRIVED' then");
    expect(stepped).toContain("stamped := case when p_out then coalesce(was.stepped_out_at, now()) end;");
    expect(stepped).toContain("return query select stamped, was.stepped_out_at;");
  });
});

describe("0018 indexes (plan §37.1)", () => {
  it("serves a patient's and a doctor's visits with an index that leads with the clinic, newest first", () => {
    expect(sql).toContain(
      "create index visits_clinic_id_patient_id_idx on public.visits (clinic_id, patient_id, visit_date desc);",
    );
    expect(sql).toContain(
      "create index visits_clinic_id_doctor_id_idx on public.visits (clinic_id, doctor_id, visit_date desc);",
    );
    expect(sql).toContain("create index vitals_clinic_id_patient_id_idx on public.vitals (clinic_id, patient_id);");
  });

  it("indexes every foreign key", () => {
    expect(sql).toContain("create index visits_created_by_idx on public.visits (created_by);");
    expect(sql).toContain("create index visits_updated_by_idx on public.visits (updated_by);");
    expect(sql).toContain("create index vitals_recorded_by_idx on public.vitals (recorded_by);");
    expect(sql).toContain("create index vitals_updated_by_idx on public.vitals (updated_by);");
    // The appointment and the visit each have their unique index.
    expect(visits).toContain("appointment_id uuid unique,");
    expect(vitals).toContain("visit_id uuid not null unique,");
  });
});

describe("0018 policies and grants (plan §27.4)", () => {
  it("is read with visits.view, a doctor only their own patients', worked out once a statement", () => {
    for (const name of ["visits_select", "vitals_select"]) {
      const select = policy(name);
      expect(select).toContain("clinic_id = (select public.current_clinic_id())");
      expect(select).toContain("(select public.has_permission('visits.view'))");
      expect(select).toContain(
        "((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))",
      );
      expect(select).not.toContain("can_see_patient");
    }
  });

  it("is written only through its functions", () => {
    expect(sql).toContain("grant select on public.visits to authenticated;");
    expect(sql).toContain("grant select on public.vitals to authenticated;");
    expect(sql).not.toMatch(/grant [^;]*(insert|update|delete)[^;]* on public\.(visits|vitals)/);
    for (const name of [
      "send_in(uuid, text)",
      "mark_done(uuid)",
      "next_patient(uuid, uuid)",
      "back_to_waiting(uuid)",
      "mark_stepped_out(uuid, boolean)",
    ]) {
      expect(sql).toContain(`revoke all on function public.${name} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${name} to authenticated;`);
    }
    for (const name of [
      "check_visit()",
      "add_visit_doctor()",
      "visit_is_empty(uuid)",
      "queue_appointment(uuid)",
      "start_appointment(public.appointments)",
      "finish_appointment(public.appointments)",
      "check_sent_in(public.appointments)",
      "sent_in(public.appointments)",
    ]) {
      expect(sql).toContain(`revoke all on function public.${name} from public, anon, authenticated;`);
    }
  });

  it("refuses with the app's own codes", () => {
    const codes = new Set([...sql.matchAll(/hint = '(\w+)'/g)].map((match) => match[1]));
    for (const code of codes) expect(isErrorMessageCode(code), code).toBe(true);
    expect(codes).toContain("DOCTOR_ROOM_TAKEN");
    expect(codes).toContain("APPOINTMENT_HAS_VISIT");
  });
});
