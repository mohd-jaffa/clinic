import { describe, expect, it } from "vitest";

import { functionBody, latestFunctionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0032_bill_doctor.sql");
const start = functionBody(sql, "bill_start");
const before = functionBody(readMigration("0030_bill_start.sql"), "bill_start");

describe("0032 a bill's doctor (plan §15.2, §18, §22.1; D326, D327, D341, D342)", () => {
  it("starts a patient's bill on their assigned doctor, only while that doctor practises (D326)", () => {
    expect(start).toContain(
      "if p_patient_id is not null then\n    doctor := found_patient.assigned_doctor_id;\n  end if;",
    );
    expect(start).toContain("and (p_patient_id is null or (bill_doctor.active and member.status = 'ACTIVE'))");
  });

  it("lists the clinic's active doctors with their own fees for a patient's bill, by name (D342)", () => {
    expect(start).toContain("'doctors', case when p_patient_id is not null then coalesce((");
    expect(start).toContain("'fee_paise', active_doctor.consultation_fee_paise");
    expect(start).toContain("order by profile.full_name, active_doctor.id");
    expect(start).toContain(
      "where active_doctor.clinic_id = clinic and active_doctor.active and member.status = 'ACTIVE'",
    );
    expect(start).toContain("), '[]'::jsonb) else '[]'::jsonb end,");
  });

  it("names the patient's mobile, for the bill sent on WhatsApp (D327, D341)", () => {
    expect(start).toContain("'phone', found_patient.phone,");
  });

  it("keeps everything else of 0030's: its guard, scope and parts", () => {
    for (const kept of [
      "security definer",
      "set search_path = ''",
      "public.has_permission('payments.create')",
      "num_nonnulls(p_visit_id, p_appointment_id, p_patient_id) <> 1",
      "not public.can_see_patient(found_patient.id)",
      "'consultation_billed', exists (",
      "'to_bill', case when p_patient_id is not null then (",
    ]) {
      expect(before, kept).toContain(kept);
      expect(start, kept).toContain(kept);
    }
  });

  it("is called by members only, and is the one the database runs", () => {
    expect(sql).toContain("revoke all on function public.bill_start(uuid, uuid, uuid) from public, anon;");
    expect(sql).toContain("grant execute on function public.bill_start(uuid, uuid, uuid) to authenticated;");
    expect(latestFunctionBody("bill_start")).toBe(start);
  });
});
