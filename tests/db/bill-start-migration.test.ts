import { describe, expect, it } from "vitest";

import { isErrorMessageCode } from "@/constants/messages";
import { functionBody, latestFunctionBody, quoted, readMigration } from "@tests/support/sql";

const sql = readMigration("0030_bill_start.sql");
const start = functionBody(sql, "bill_start");

describe("0030 where a new bill starts (plan §15.2, §28.7; D302 – D313)", () => {
  it("is for whoever may issue a bill, from exactly one of a visit, an arrival or a patient", () => {
    expect(start).toContain("security definer");
    expect(start).toContain("set search_path = ''");
    expect(start).toContain("stable");
    expect(start).toContain("public.has_permission('payments.create')");
    expect(start).toContain("num_nonnulls(p_visit_id, p_appointment_id, p_patient_id) <> 1");
  });

  it("reads within the caller's clinic and doctor scope, and finds nothing else", () => {
    expect(start).toContain("visit.id = p_visit_id and visit.clinic_id = clinic");
    expect(start).toContain("appointment.id = p_appointment_id and appointment.clinic_id = clinic");
    expect(start).toContain("candidate.id = patient and candidate.clinic_id = clinic");
    expect(start).toContain("not public.can_see_patient(found_patient.id)");
    expect(start).toContain("hint = 'RECORD_NOT_FOUND'");
  });

  it("refuses in the app's own words", () => {
    for (const hint of quoted(start.match(/hint = '[A-Z_]+'/g)!.join(" "))) {
      expect(isErrorMessageCode(hint), hint).toBe(true);
    }
  });

  it("names the patient, the visit or arrival, and the doctor with their own fee (D26)", () => {
    expect(start).toContain("'archived', found_patient.archived_at is not null");
    expect(start).toContain("'billing_status', found_visit.billing_status");
    expect(start).toContain("'token_number', found_appointment.token_number");
    expect(start).toContain("'fee_paise', bill_doctor.consultation_fee_paise");
  });

  it("says whether a consultation is billed already for the visit or its arrival (D286)", () => {
    expect(start).toContain("'consultation_billed', exists (");
    expect(start).toContain("(bill.visit_id = found_visit.id or bill.appointment_id = billed_appointment)");
    expect(start).toContain("service.category = 'CONSULTATION'");
    expect(start).toContain("bill.status = 'ISSUED'");
  });

  it("lists the treatments worked on in the visit not yet on a bill for it, oldest first (D285, D308)", () => {
    expect(start).toContain("session.visit_id = found_visit.id");
    expect(start).toContain("item.treatment_id = treatment.id");
    expect(start).toContain("order by treatment.created_at, treatment.id");
  });

  it("gives the balance kept for the patient (D295), and from a patient their oldest visit to bill (D313)", () => {
    expect(start).toContain("from public.patient_balances as balance where balance.patient_id = found_patient.id");
    expect(start).toContain("'to_bill', case when p_patient_id is not null then (");
    expect(start).toContain("visit.billing_status = 'TO_BILL'");
    expect(start).toContain("order by visit.visit_date, visit.completed_at");
  });

  it("is called by members only, and is carried on by 0032", () => {
    expect(sql).toContain("revoke all on function public.bill_start(uuid, uuid, uuid) from public, anon;");
    expect(sql).toContain("grant execute on function public.bill_start(uuid, uuid, uuid) to authenticated;");
    // 0032 redefines it with the bill's doctor (R8.8).
    expect(latestFunctionBody("bill_start")).toContain("'consultation_billed', exists (");
  });
});
