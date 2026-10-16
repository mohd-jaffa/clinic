import { describe, expect, it } from "vitest";

import { VITAL_SIGNS } from "@/constants/clinical";
import { VITAL_COLUMNS } from "@/features/visits/vitals";
import { functionBody, latestFunctionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0022_patient_timeline.sql");

describe("0022 a patient's visits, newest first (plan §37.1, D225)", () => {
  it("are read on an index in the history's own order, led by the clinic", () => {
    expect(sql).toContain(
      "create index visits_clinic_id_patient_id_created_at_idx\n  on public.visits (clinic_id, patient_id, created_at desc, id desc);",
    );
  });
});

describe("0022 visit_recorded (D197, D226)", () => {
  const recorded = functionBody(sql, "visit_recorded");

  it("is a computed field of a visit, run as the caller, for the signed-in only", () => {
    expect(recorded).toContain("public.visit_recorded(p_visit public.visits)\nreturns boolean");
    expect(recorded).not.toContain("security definer");
    expect(sql).toContain("revoke all on function public.visit_recorded(public.visits) from public, anon;");
    expect(sql).toContain("grant execute on function public.visit_recorded(public.visits) to authenticated;");
  });

  it("counts notes, a follow-up, any reading taken, and a prescription with a medicine or advice", () => {
    for (const field of ["complaint", "diagnosis", "notes", "follow_up_on"]) {
      expect(recorded).toContain(`p_visit.${field} is not null`);
    }
    for (const sign of VITAL_SIGNS) expect(recorded).toContain(`vital.${VITAL_COLUMNS[sign]} is not null`);
    expect(recorded).toContain("prescription.advice is not null");
    expect(recorded).toContain(
      "exists (select 1 from public.prescription_items as item where item.prescription_id = prescription.id)",
    );
  });

  it("is what visit_is_empty denies, so Back to waiting and the history never disagree", () => {
    const empty = functionBody(sql, "visit_is_empty");
    expect(empty).toContain("security definer");
    expect(empty).toContain(
      "coalesce((select not public.visit_recorded(visit) from public.visits as visit where visit.id = p_visit_id), true)",
    );
    // 0028 keeps it so, a bill naming the visit keeping it too (D197).
    expect(latestFunctionBody("visit_is_empty")).toContain("select not public.visit_recorded(visit)");
  });
});

describe("0022 last_visit_on (plan §10.2; D228)", () => {
  const last = functionBody(sql, "last_visit_on");

  it("is a computed field of a patient: the day of their latest visit", () => {
    expect(last).toContain("public.last_visit_on(p_patient public.patients)\nreturns date");
    expect(last).toContain("select max(visit.visit_date)");
    expect(last).toContain("where visit.clinic_id = p_patient.clinic_id\n     and visit.patient_id = p_patient.id");
  });

  it("reads past the visits' policy only for a patient the caller may see, whatever row is handed in", () => {
    expect(last).toContain("security definer");
    expect(last).toContain("p_patient.clinic_id = (select public.current_clinic_id())");
    expect(last).toContain("(select public.has_permission('patients.view'))");
    expect(last).toContain(
      "((select public.sees_every_patient()) or p_patient.id in (select public.doctor_patient_ids()))",
    );
    expect(sql).toContain("revoke all on function public.last_visit_on(public.patients) from public, anon;");
    expect(sql).toContain("grant execute on function public.last_visit_on(public.patients) to authenticated;");
  });
});
