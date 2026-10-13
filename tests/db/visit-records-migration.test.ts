import { describe, expect, it } from "vitest";

import { VITAL_SIGNS } from "@/constants/clinical";
import { VITAL_COLUMNS } from "@/features/visits/vitals";
import { functionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0020_visit_records.sql");

describe("0020 a visit opened before Send in (D203)", () => {
  it("has not started until the patient goes in: its day is the day it opened", () => {
    expect(sql).toContain("alter table public.visits alter column started_at drop not null;");
    expect(functionBody(sql, "check_visit")).toContain(
      "select (coalesce(new.started_at, now()) at time zone clinic.timezone)::date into new.visit_date",
    );
  });

  it("is continued by Send in, which starts it then — one kept by Back to waiting keeps when it first went in", () => {
    const start = functionBody(sql, "start_appointment");
    expect(start).toContain("set started_at = coalesce(kept.started_at, now())");
    expect(start).toContain("where kept.appointment_id = p_appointment.id and kept.status = 'OPEN'");
  });
});

describe("0020 what counts as recorded", () => {
  it("is a reading taken, not a vitals row with every reading cleared", () => {
    const empty = functionBody(sql, "visit_is_empty");
    for (const sign of VITAL_SIGNS) expect(empty).toContain(`vital.${VITAL_COLUMNS[sign]} is not null`);
  });

  it("has Back to waiting remove an empty visit with its emptied vitals", () => {
    const back = functionBody(sql, "back_to_waiting");
    expect(back).toMatch(
      /public\.visit_is_empty\(visit\) then\s+delete from public\.vitals where visit_id = visit;\s+delete from public\.visits where id = visit;/,
    );
  });
});

describe("0020 saving a section (D202, D206, D208)", () => {
  it("writes a visit the clinic's, within the doctor scope, writable, its patient not archived — visits.edit once done", () => {
    const held = functionBody(sql, "visit_for_change");
    expect(held).toContain("perform public.require_clinic_write(clinic);");
    expect(held).toContain("for update;");
    expect(held).toContain("not public.can_see_patient(found.patient_id)");
    expect(held).toContain(
      "public.has_permission(case when found.status = 'COMPLETED' then 'visits.edit' else p_permission end)",
    );
    expect(held).toContain("hint = 'PATIENT_ARCHIVED'");
  });

  it("saves the vitals from the copy read, for a visit or a waiting patient whose visit opens with them", () => {
    const vitals = functionBody(sql, "save_vitals");
    expect(vitals).toContain("visit := public.visit_for_change(p_visit_id, 'visits.create');");
    expect(vitals).toContain("appointment := public.appointment_for_change(p_appointment_id, 'visits.create');");
    expect(vitals).toContain("if appointment.status not in ('ARRIVED', 'IN_PROGRESS') then");
    expect(vitals).toContain("perform public.check_sent_in(appointment);");
    expect(vitals).toMatch(/if not taken then\s+raise exception [^;]*'VALIDATION_ERROR'/);
    expect(vitals).toMatch(/if before is distinct from p_seen then\s+raise exception [^;]*'VISIT_CHANGED'/);
    expect(vitals).toContain("on conflict (visit_id) do update");
    for (const sign of VITAL_SIGNS) expect(vitals).toContain(`(p_vitals ->> '${VITAL_COLUMNS[sign]}')`);
  });

  it("saves a visit's own section from the copy read — the named fields only, a follow-up after the visit's day", () => {
    const update = functionBody(sql, "update_visit");
    expect(update).toContain("public.visit_for_change(p_visit_id, 'visits.edit')");
    expect(update).toContain("not fields <@ array['complaint', 'diagnosis', 'notes', 'follow_up_on']");
    expect(update).toMatch(/if before is distinct from p_seen then\s+raise exception [^;]*'VISIT_CHANGED'/);
    expect(update).toMatch(/\(p_changes ->> 'follow_up_on'\)::date <= visit\.visit_date then\s+raise exception/);
  });
});

describe("0020 New visit and its Done (D204)", () => {
  it("starts one for visits.create, the clinic's patient and active doctor, or finds the one open with them", () => {
    const start = functionBody(sql, "start_visit");
    expect(start).toContain("not public.has_permission('visits.create')");
    expect(start).toContain("perform public.require_clinic_write(clinic);");
    expect(start).toContain("hint = 'PATIENT_ARCHIVED'");
    expect(start).toContain("hint = 'DOCTOR_INACTIVE'");
    expect(start).toContain("perform public.hold_doctor(p_doctor_id);");
    expect(start).toContain("open.status = 'OPEN' and open.started_at is not null");
  });

  it("closes one with no appointment as To bill, and leaves a queue visit to the queue", () => {
    const finish = functionBody(sql, "finish_visit");
    expect(finish).toMatch(
      /if found\.appointment_id is not null then\s+raise exception [^;]*'APPOINTMENT_STATUS_NOT_ALLOWED'/,
    );
    expect(finish).toContain("set status = 'COMPLETED', completed_at = now(), billing_status = 'TO_BILL'");
  });
});

describe("0020 grants (plan §27.4)", () => {
  it("lets members call the saves and starts, and nothing reach the helpers", () => {
    for (const name of [
      "save_vitals(uuid, uuid, jsonb, jsonb)",
      "update_visit(uuid, jsonb, jsonb)",
      "start_visit(uuid, uuid)",
      "finish_visit(uuid)",
    ]) {
      expect(sql).toContain(`revoke all on function public.${name} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${name} to authenticated;`);
    }
    for (const name of ["visit_for_change(uuid, text)", "vitals_of(uuid)"]) {
      expect(sql).toContain(`revoke all on function public.${name} from public, anon, authenticated;`);
    }
  });

  it("adds no read but the visit's own: the open visit New visit looks for is on the patient's index", () => {
    expect(sql).not.toContain("create index");
    expect(sql).not.toContain("create policy");
  });
});
