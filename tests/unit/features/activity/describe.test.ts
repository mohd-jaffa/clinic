import { describe, expect, it } from "vitest";

import type { AuditAction } from "@/constants/statuses";
import { changeLines, describeActivity, subjectOf } from "@/features/activity/describe";
import type { ActivityEntry } from "@/features/activity/types";
import { anActivityEntry, change } from "@tests/support/activity";

const DOCTOR = "11111111-1111-4111-8111-111111111111";
const CATEGORY = "22222222-2222-4222-8222-222222222222";

/** A row of one record, with only these changes. */
const row = (
  entityType: string,
  action: AuditAction,
  changes: ActivityEntry["changes"],
  extra: Partial<ActivityEntry> = {},
) => anActivityEntry({ entityType, action, changes, record: null, ...extra });
const said = (
  entityType: string,
  action: AuditAction,
  changes: ActivityEntry["changes"],
  extra: Partial<ActivityEntry> = {},
) => describeActivity(row(entityType, action, changes, extra));

describe("describeActivity (plan §19; D387)", () => {
  it("says a patient added, imported, changed, archived and restored", () => {
    expect(said("patients", "CREATE", { patient_number: change(null, 1023) })).toBe("Added a patient");
    expect(said("patients", "CREATE", { imported: 120, patient_number: change(1001, 1120) })).toBe(
      "Imported 120 patients",
    );
    expect(said("patients", "CREATE", { imported: 1, patient_number: change(1001, 1001) })).toBe("Imported 1 patient");
    expect(said("patients", "UPDATE", { fields: ["phone"] })).toBe("Changed a patient’s details");
    expect(said("patients", "ARCHIVE", { archived_at: change(null, "2026-10-30T05:00:00Z") })).toBe(
      "Archived a patient",
    );
    expect(said("patients", "RESTORE", {})).toBe("Restored a patient");
  });

  it("says an alert added by its kind, turned off, or changed", () => {
    expect(said("patient_alerts", "CREATE", { kind: change(null, "ALLERGY") })).toBe("Added an allergy alert");
    expect(said("patient_alerts", "CREATE", { kind: change(null, "CONDITION") })).toBe("Added a condition alert");
    expect(said("patient_alerts", "UPDATE", { active: change(true, false) })).toBe("Turned off an alert");
    expect(said("patient_alerts", "UPDATE", { fields: ["label"] })).toBe("Changed an alert");
  });

  it("says an appointment booked, a walk-in added, and each move of its status", () => {
    expect(said("appointments", "CREATE", { scheduled_at: change(null, "2026-10-31T05:30:00Z") })).toBe(
      "Booked an appointment for 31 Oct 2026, 11:00 AM",
    );
    expect(said("appointments", "CREATE", { token_number: change(null, 4) })).toBe("Added a walk-in · token 4");
    const to = (from: string, status: string, extra = {}) =>
      said("appointments", "STATUS_CHANGE", { status: change(from, status), ...extra });
    expect(to("SCHEDULED", "CONFIRMED")).toBe("Confirmed an appointment");
    expect(to("CONFIRMED", "SCHEDULED")).toBe("Set an appointment back to scheduled");
    expect(to("SCHEDULED", "NO_SHOW")).toBe("Marked a no-show");
    expect(to("SCHEDULED", "CANCELLED", { fields: ["cancel_reason"] })).toBe("Cancelled an appointment");
    expect(to("SCHEDULED", "ARRIVED", { token_number: change(null, 7) })).toBe("Marked arrived · token 7");
    expect(to("SCHEDULED", "ARRIVED")).toBe("Marked arrived");
    expect(to("IN_PROGRESS", "ARRIVED")).toBe("Sent back to waiting");
    expect(to("ARRIVED", "IN_PROGRESS")).toBe("Sent in to the doctor");
    expect(to("IN_PROGRESS", "COMPLETED")).toBe("Marked done");
  });

  it("says an appointment reminded, stepped out and back, urgent or not, moved or changed", () => {
    const update = (changes: ActivityEntry["changes"]) => said("appointments", "UPDATE", changes);
    expect(update({ reminded_at: change(null, "2026-10-30T05:00:00Z") })).toBe("Sent an appointment reminder");
    expect(update({ stepped_out_at: change(null, "2026-10-30T05:00:00Z") })).toBe("Marked stepped out");
    expect(update({ stepped_out_at: change("2026-10-30T05:00:00Z", null) })).toBe("Marked back");
    expect(update({ urgent_at: change(null, "2026-10-30T05:00:00Z") })).toBe("Marked urgent");
    expect(update({ urgent_at: change("2026-10-30T05:00:00Z", null) })).toBe("Marked not urgent");
    expect(update({ scheduled_at: change("2026-10-31T05:30:00Z", "2026-11-01T04:30:00Z") })).toBe(
      "Moved an appointment to 1 Nov 2026, 10:00 AM",
    );
    expect(update({ doctor_id: change(DOCTOR, null) })).toBe("Changed an appointment");
    expect(said("appointments", "STATUS_CHANGE", {})).toBe("Changed an appointment");
  });

  it("says a visit opened, done, removed, billed, back to To bill, No charge, or updated", () => {
    expect(said("visits", "CREATE", { status: change(null, "OPEN") })).toBe("Opened a visit");
    expect(said("visits", "CREATE", { status: change(null, "COMPLETED") })).toBe("Marked a visit done");
    expect(said("visits", "STATUS_CHANGE", { status: change("OPEN", "COMPLETED") })).toBe("Marked a visit done");
    expect(said("visits", "DELETE", { status: change("OPEN", null) })).toBe("Removed an empty visit");
    expect(said("visits", "UPDATE", { billing_status: change("TO_BILL", "BILLED") })).toBe("Billed a visit");
    expect(said("visits", "UPDATE", { billing_status: change("BILLED", "TO_BILL") })).toBe(
      "Put a visit back to To bill",
    );
    expect(said("visits", "UPDATE", { billing_status: change("TO_BILL", "NO_CHARGE") })).toBe(
      "Marked a visit No charge",
    );
    expect(said("visits", "UPDATE", { fields: ["notes"] })).toBe("Updated a visit");
  });

  it("says vitals and prescriptions", () => {
    expect(said("vitals", "UPDATE", { fields: ["pulse"] })).toBe("Recorded vitals");
    expect(said("prescriptions", "CREATE", { fields: ["items"] })).toBe("Wrote a prescription");
    expect(said("prescriptions", "UPDATE", { fields: ["advice"] })).toBe("Changed a prescription");
  });

  it("says a named item by its name — the record's, or the change's — for each of its four lines", () => {
    const types = ["prescription_templates", "services", "appointment_types", "expense_categories"];
    expect(types.map((type) => said(type, "CREATE", { name: change(null, "Fever") }))).toEqual([
      "Added the prescription template Fever",
      "Added Fever to the price list",
      "Added the appointment type Fever",
      "Added the expense category Fever",
    ]);
    expect(types.map((type) => said(type, "UPDATE", {}, { record: { name: "Fever" } }))).toEqual([
      "Changed the prescription template Fever",
      "Changed Fever on the price list",
      "Changed the appointment type Fever",
      "Changed the expense category Fever",
    ]);
    expect(
      types.map((type) => said(type, "ARCHIVE", { active: change(true, false) }, { record: { name: "Fever" } })),
    ).toEqual([
      "Archived the prescription template Fever",
      "Archived Fever from the price list",
      "Archived the appointment type Fever",
      "Archived the expense category Fever",
    ]);
    expect(types.map((type) => said(type, "RESTORE", null, { record: { name: "Fever" } }))).toEqual([
      "Restored the prescription template Fever",
      "Restored Fever to the price list",
      "Restored the appointment type Fever",
      "Restored the expense category Fever",
    ]);
    expect(said("services", "UPDATE", {})).toBe("Changed — on the price list");
  });

  it("says a treatment added, moved through its statuses, changed; and its sittings", () => {
    expect(said("treatments", "CREATE", { status: change(null, "PLANNED") })).toBe("Added a treatment");
    const to = (status: string) => said("treatments", "STATUS_CHANGE", { status: change("PLANNED", status) });
    expect(["PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"].map(to)).toEqual([
      "Set a treatment back to planned",
      "Started a treatment",
      "Put a treatment on hold",
      "Completed a treatment",
      "Cancelled a treatment",
    ]);
    expect(said("treatments", "STATUS_CHANGE", {})).toBe("Changed a treatment");
    expect(said("treatments", "UPDATE", { next_due_on: change(null, "2026-11-05") })).toBe("Changed a treatment");
    expect(said("treatment_sessions", "CREATE", {})).toBe("Recorded a sitting");
    expect(said("treatment_sessions", "UPDATE", { fields: ["note"] })).toBe("Changed a sitting’s note");
    expect(said("treatment_sessions", "DELETE", null)).toBe("Removed a sitting");
    expect(said("follow_up_contacts", "CREATE", { outcome: change(null, "NO_ANSWER") })).toBe(
      "Noted a follow-up: No answer",
    );
  });

  it("says a bill issued and voided, and a payment or refund recorded and voided", () => {
    expect(
      said("bills", "CREATE", { bill_number: change(null, "2026-27/0042"), total_paise: change(null, 150_000) }),
    ).toBe("Issued bill 2026-27/0042 · ₹1,500");
    expect(
      said("bills", "UPDATE", { status: change("ISSUED", "VOID") }, { record: { bill_number: "2026-27/0042" } }),
    ).toBe("Voided bill 2026-27/0042");
    expect(said("bills", "UPDATE", { status: change("ISSUED", "VOID") })).toBe("Voided bill —");
    expect(describeActivity(anActivityEntry())).toBe("Recorded a payment of ₹2,000 · UPI");
    expect(
      said("payments", "CREATE", {
        kind: change(null, "REFUND"),
        amount_paise: change(null, 50_000),
        method: change(null, "CASH"),
      }),
    ).toBe("Gave a refund of ₹500 · Cash");
    const voided = (kind: string) =>
      said("payments", "UPDATE", { status: change("RECORDED", "VOID") }, { record: { kind, amount_paise: 50_000 } });
    expect(voided("PAYMENT")).toBe("Voided a payment of ₹500");
    expect(voided("REFUND")).toBe("Voided a refund of ₹500");
  });

  it("says an expense by its category: the record's, or the one its change names", () => {
    const names = { [CATEGORY]: "Rent" };
    expect(
      said(
        "expenses",
        "CREATE",
        { amount_paise: change(null, 50_000), category_id: change(null, CATEGORY) },
        { names },
      ),
    ).toBe("Added an expense of ₹500 · Rent");
    expect(said("expenses", "UPDATE", {}, { record: { category: "Supplies" } })).toBe("Changed an expense · Supplies");
    expect(said("expenses", "ARCHIVE", null, { record: { category: "Rent" } })).toBe("Archived an expense · Rent");
    expect(said("expenses", "RESTORE", null, { record: { category: "Rent" } })).toBe("Restored an expense · Rent");
    expect(said("expenses", "UPDATE", { category_id: change(CATEGORY, CATEGORY) })).toBe("Changed an expense · —");
    expect(said("expenses", "UPDATE", {})).toBe("Changed an expense · —");
  });

  it("says the clinic closed, a doctor's leave, and each removed", () => {
    const names = { [DOCTOR]: "Dr Rahul" };
    const closure = {
      reason: change(null, "Diwali"),
      starts_on: change(null, "2026-11-01"),
      ends_on: change(null, "2026-11-02"),
    };
    expect(said("clinic_closures", "CREATE", { ...closure, doctor_id: change(null, null) })).toBe(
      "Closed the clinic: Diwali",
    );
    expect(said("clinic_closures", "CREATE", { ...closure, doctor_id: change(null, DOCTOR) }, { names })).toBe(
      "Added Dr Rahul’s leave: Diwali",
    );
    const removed = { reason: change("Diwali", null), doctor_id: change(DOCTOR, null) };
    expect(said("clinic_closures", "DELETE", removed, { names })).toBe("Removed Dr Rahul’s leave: Diwali");
    expect(said("clinic_closures", "DELETE", removed)).toBe("Removed —’s leave: Diwali");
    expect(said("clinic_closures", "DELETE", { reason: change("Diwali", null) })).toBe("Removed the closure: Diwali");
    expect(said("clinic_closures", "DELETE", {})).toBe("Removed the closure: —");
  });

  it("says the team: invited, revoked, joined, deactivated, reactivated, sent again, changed", () => {
    expect(said("clinic_members", "CREATE", { email: change(null, "anu@x.in"), role: change(null, "DOCTOR") })).toBe(
      "Invited anu@x.in as a doctor",
    );
    expect(said("clinic_members", "DELETE", { email: change("anu@x.in", null) })).toBe(
      "Revoked the invite to anu@x.in",
    );
    const member = { record: { name: "Anu Rao", email: "anu@x.in" } };
    expect(said("clinic_members", "STATUS_CHANGE", { status: change("INVITED", "ACTIVE") }, member)).toBe(
      "Joined the team",
    );
    expect(said("clinic_members", "STATUS_CHANGE", { status: change("ACTIVE", "INACTIVE") }, member)).toBe(
      "Deactivated Anu Rao",
    );
    expect(said("clinic_members", "STATUS_CHANGE", { status: change("INACTIVE", "ACTIVE") }, member)).toBe(
      "Reactivated Anu Rao",
    );
    expect(said("clinic_members", "UPDATE", { invite_expires_at: change("a", "b") }, member)).toBe(
      "Sent Anu Rao’s invite again",
    );
    expect(said("clinic_members", "UPDATE", { job_title: change(null, "Nurse") }, member)).toBe(
      "Changed Anu Rao’s access",
    );
    expect(
      said("clinic_members", "UPDATE", { job_title: change(null, "Nurse") }, { record: { email: "anu@x.in" } }),
    ).toBe("Changed anu@x.in’s access");
    expect(said("clinic_members", "UPDATE", {})).toBe("Changed a member’s access");
  });

  it("says the clinic signed up, its logo changed or removed, its details changed; and anything else plainly", () => {
    expect(said("clinics", "CREATE", { trial: true })).toBe("Signed up the clinic");
    expect(said("clinics", "UPDATE", { logo: change(null, "abc") })).toBe("Changed the logo");
    expect(said("clinics", "UPDATE", { logo: change("abc", null) })).toBe("Removed the logo");
    expect(said("clinics", "UPDATE", { city: change("Kochi", "Kollam") })).toBe("Changed the clinic’s details");
    expect(said("ledgers", "UPDATE", {})).toBe("ledgers · UPDATE");
  });
});

describe("subjectOf (D387)", () => {
  it("names the patient by name and number, an import by its numbers, a closure by its days", () => {
    expect(subjectOf(anActivityEntry())).toBe("Meena Iyer · P-1023");
    const imported = { patient: null, entityType: "patients" };
    expect(
      subjectOf(anActivityEntry({ ...imported, changes: { imported: 2, patient_number: change(1001, 1002) } })),
    ).toBe("P-1001 – P-1002");
    expect(
      subjectOf(anActivityEntry({ ...imported, changes: { imported: 1, patient_number: change(1001, 1001) } })),
    ).toBe("P-1001");
    const closure = (from: string, to: string) =>
      anActivityEntry({
        patient: null,
        entityType: "clinic_closures",
        changes: { starts_on: change(null, from), ends_on: change(null, to) },
      });
    expect(subjectOf(closure("2026-11-01", "2026-11-02"))).toBe("1 Nov 2026 – 2 Nov 2026");
    expect(subjectOf(closure("2026-11-01", "2026-11-01"))).toBe("1 Nov 2026");
    expect(subjectOf(anActivityEntry({ patient: null, entityType: "patients", changes: {} }))).toBeNull();
    expect(subjectOf(anActivityEntry({ patient: null, entityType: "services" }))).toBeNull();
  });
});

describe("changeLines (D389)", () => {
  const lines = (entry: Partial<ActivityEntry>) => changeLines(anActivityEntry(entry));

  it("says what a record was made with, money and days as read, the patient apart", () => {
    expect(lines({})).toEqual([
      { label: "Amount", value: "₹2,000" },
      { label: "Method", value: "UPI" },
      { label: "Paid on", value: "30 Oct 2026" },
      { label: "Kind", value: "Payment" },
    ]);
    expect(
      lines({
        entityType: "patients",
        changes: {
          patient_number: change(null, 1023),
          assigned_doctor_id: change(null, null),
          fields: ["full_name", "phone"],
        },
      }),
    ).toEqual([{ label: "Filled in", value: "Name, Mobile" }]);
  });

  it("says each change from and to, names for ids, and clinical text by name alone", () => {
    const names = { [DOCTOR]: "Dr Rahul" };
    expect(
      lines({
        action: "UPDATE",
        entityType: "appointments",
        names,
        changes: {
          doctor_id: change(DOCTOR, "33333333-3333-4333-8333-333333333333"),
          scheduled_at: change("2026-10-31T05:30:00Z", "2026-11-01T04:30:00Z"),
          status: change("CONFIRMED", "SCHEDULED"),
          visit_id: change(null, "v-1"),
          fields: ["notes"],
        },
      }),
    ).toEqual([
      { label: "Status", value: "Confirmed → Scheduled" },
      { label: "Time", value: "31 Oct 2026, 11:00 AM → 1 Nov 2026, 10:00 AM" },
      { label: "Doctor", value: "Dr Rahul → —" },
      { label: "Changed", value: "Notes" },
    ]);
  });

  it("says what a record removed held, leaving out what it never had", () => {
    expect(
      lines({
        action: "DELETE",
        entityType: "clinic_closures",
        changes: {
          reason: change("Diwali", null),
          doctor_id: change(null, null),
          ends_on: change("2026-11-02", null),
        },
      }),
    ).toEqual([
      { label: "To", value: "2 Nov 2026" },
      { label: "Reason", value: "Diwali" },
    ]);
  });

  it("says each kind of value as a person reads it", () => {
    const one = (entityType: string, key: string, from: unknown, to: unknown) =>
      changeLines(anActivityEntry({ action: "UPDATE", entityType, changes: { [key]: change(from, to) } }))[0];
    expect(one("clinic_members", "permissions", "patients.view", "patients.view,patients.create")).toEqual({
      label: "Permissions",
      value: "See patients → See patients, Add patients",
    });
    expect(one("clinic_members", "permissions", ["patients.view"], ["unknown.thing"])).toEqual({
      label: "Permissions",
      value: "See patients → unknown.thing",
    });
    expect(one("clinic_members", "sees_patients", false, true).value).toBe("No → Yes");
    expect(one("clinic_members", "status", "ACTIVE", "INACTIVE").value).toBe("Active → Inactive");
    expect(one("clinic_members", "role", "STAFF", "DOCTOR").value).toBe("Staff → Doctor");
    expect(one("visits", "status", "OPEN", "COMPLETED").value).toBe("Open → Done");
    expect(one("visits", "billing_status", "TO_BILL", "NO_CHARGE").value).toBe("To bill → No charge");
    expect(one("visits", "no_charge_reason", "", "REVIEW").value).toBe("— → Review");
    expect(one("visits", "follow_up_on", undefined, "2026-11-05").value).toBe("— → 5 Nov 2026");
    expect(one("bills", "status", "ISSUED", "VOID").value).toBe("Issued → Void");
    expect(one("payments", "status", "RECORDED", "VOID").value).toBe("Recorded → Void");
    expect(one("payments", "kind", "PAYMENT", "REFUND").value).toBe("Payment → Refund");
    expect(one("patient_alerts", "kind", "ALLERGY", "CONDITION").value).toBe("Allergy → Condition");
    expect(one("treatments", "status", "PLANNED", "ON_HOLD").value).toBe("Planned → On hold");
    expect(one("treatments", "estimated_cost_paise", 100_000, 120_000).value).toBe("₹1,000 → ₹1,200");
    expect(one("services", "category", "CONSULTATION", "PROCEDURE").value).toBe("Consultation → Procedure");
    expect(one("expenses", "payment_method", "CASH", "UPI").value).toBe("Cash → UPI");
    expect(one("expenses", "expense_date", "2026-10-29", "2026-10-30").value).toBe("29 Oct 2026 → 30 Oct 2026");
    expect(one("follow_up_contacts", "snooze_until", "2026-11-01", "2026-11-02").value).toBe("1 Nov 2026 → 2 Nov 2026");
    expect(one("follow_up_contacts", "outcome", "REACHED", "BOOKED").value).toBe("Reached → Booked");
    expect(one("clinics", "clinic_type", "DENTAL", "GENERAL").value).toBe("Dental → General");
    expect(one("clinics", "paper_size", "A4", "A5").value).toBe("A4 → A5");
    expect(one("clinics", "fee_timing", "AT_ARRIVAL", "AFTER_CONSULTATION").value).toBe(
      "At arrival → After the consultation",
    );
    expect(one("appointments", "reminded_at", null, "2026-10-30T05:00:00Z").value).toBe("— → 30 Oct 2026, 10:30 AM");
    expect(one("patients", "date_of_birth", "1990-01-01", "1990-01-02").value).toBe("1 Jan 1990 → 2 Jan 1990");
    expect(one("clinics", "status", "A", "B").value).toBe("A → B");
    expect(one("clinics", "city", "Kochi", "Kollam")).toEqual({ label: "City", value: "Kochi → Kollam" });
    expect(one("clinics", "wall_colour", "red", "green")).toEqual({ label: "wall colour", value: "red → green" });
  });

  it("says a value kept plainly, and nothing of a logo's stored name", () => {
    expect(changeLines(anActivityEntry({ entityType: "clinics", changes: { trial: true } }))).toEqual([
      { label: "Free trial", value: "Yes" },
    ]);
    expect(
      changeLines(anActivityEntry({ action: "UPDATE", entityType: "clinics", changes: { logo: change("a", "b") } })),
    ).toEqual([]);
    expect(changeLines(anActivityEntry({ changes: null }))).toEqual([]);
    expect(
      changeLines(
        anActivityEntry({
          action: "UPDATE",
          entityType: "clinics",
          changes: { wall: change("a", "b"), city: change("x", "y") },
        }),
      ).map((line) => line.label),
    ).toEqual(["City", "wall"]);
  });
});
