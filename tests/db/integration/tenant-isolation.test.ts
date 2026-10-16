import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addClosure } from "@/features/clinic/closures";
import { getPrescriptionPdf } from "@/features/documents/api";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
import { getServerEnv } from "@/lib/env/server";
import {
  addMember,
  admin,
  makeDeveloper,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Clinic A's records are never clinic B's (plan §27, AGENTS.md §7). B's owner
 * holds a valid token and goes straight at the database's API, as anyone with
 * that token could: nothing of A's is there to read or to change. Every
 * clinic-owned table has a row here (AGENTS.md §7).
 */
const CLINIC_TABLES: readonly { table: string; column: string }[] = [
  { table: "clinics", column: "id" },
  { table: "clinic_members", column: "clinic_id" },
  { table: "doctors", column: "clinic_id" },
  { table: "clinic_subscriptions", column: "clinic_id" },
  { table: "subscription_payments", column: "clinic_id" },
  { table: "services", column: "clinic_id" },
  { table: "appointment_types", column: "clinic_id" },
  { table: "expense_categories", column: "clinic_id" },
  { table: "clinic_closures", column: "clinic_id" },
  { table: "patients", column: "clinic_id" },
  { table: "patient_alerts", column: "clinic_id" },
  { table: "appointments", column: "clinic_id" },
  { table: "visits", column: "clinic_id" },
  { table: "vitals", column: "clinic_id" },
  { table: "prescriptions", column: "clinic_id" },
  { table: "prescription_items", column: "clinic_id" },
  { table: "prescription_templates", column: "clinic_id" },
  { table: "prescription_template_items", column: "clinic_id" },
  { table: "treatments", column: "clinic_id" },
  { table: "treatment_sessions", column: "clinic_id" },
  { table: "follow_up_contacts", column: "clinic_id" },
  { table: "bills", column: "clinic_id" },
  { table: "bill_items", column: "clinic_id" },
  { table: "audit_logs", column: "clinic_id" },
];

/**
 * A clinic's tables only the database itself reads and writes: the patient
 * counter, the doctor scope (0015), the tokens (0017), the bill numbers (0028).
 */
const DATABASE_TABLES = ["patient_counters", "patient_doctors", "daily_tokens", "bill_counters"];

/** The platform's own tables: no signed-in member, nor the DEV's own token, reads them. */
const PLATFORM_TABLES = ["platform_settings", "trial_claims", "receipt_counters", "error_logs"];

let a: TestClinic;
let b: TestClinic;
let developer: SignedIn;
/** A's patient and their appointment, which B's owner goes looking for. */
let patientId: string;
let appointmentId: string;
let visitId: string;
let doctorId: string;
/** A's doctor's prescription template (0023). */
let templateId: string;
/** A's patient's treatment and its session in A's visit (0024). */
let treatmentId: string;
let sessionId: string;
/** A's bill for that visit, issued in the room (0028). */
let billId: string;

beforeAll(async () => {
  [a, b] = await Promise.all([registerClinic({ clinicName: "Clinic A" }), registerClinic({ clinicName: "Clinic B" })]);
  await addMember(a.clinicId, { role: "DOCTOR", permissions: ["patients.view"] });
  await addClosure(a.owner.tenant, { doctorId: null, startsOn: todayKey(), endsOn: todayKey(), reason: "Holiday" });
  const { data: patient, error } = await a.owner.tenant.supabase
    .rpc("create_patient", {
      p_patient: { full_name: "Rohan Mehta", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  patientId = patient.patient_id;
  await a.owner.tenant.supabase
    .from("patient_alerts")
    .insert({ clinic_id: a.clinicId, patient_id: patientId, kind: "ALLERGY", label: "Penicillin" });
  const [{ data: type }, { data: doctor }] = await Promise.all([
    admin().from("appointment_types").select("id").eq("clinic_id", a.clinicId).eq("name", "Consultation").single(),
    admin().from("doctors").select("id").eq("member_id", a.owner.session.membership!.id).single(),
  ]);
  // Tomorrow: today is A's holiday, above.
  const { data: appointment, error: refused } = await a.owner.tenant.supabase
    .rpc("create_appointment", {
      p_appointment: {
        patient_id: patientId,
        doctor_id: doctor!.id,
        appointment_type_id: type!.id,
        scheduled_at: dayHour(addDaysKey(todayKey(), 1), 10),
        duration_minutes: 15,
      },
      p_idempotency_key: randomUUID(),
    })
    .single<{ appointment_id: string }>();
  if (refused) throw refused;
  appointmentId = appointment.appointment_id;
  doctorId = doctor!.id as string;
  // A's visit and its vitals, put in place as the queue and the visit screen leave them.
  const { data: visit, error: unvisited } = await admin()
    .from("visits")
    .insert({ clinic_id: a.clinicId, patient_id: patientId, doctor_id: doctorId, appointment_id: appointmentId })
    .select("id")
    .single();
  if (unvisited) throw unvisited;
  visitId = visit.id as string;
  const { error: unrecorded } = await admin()
    .from("vitals")
    .insert({ clinic_id: a.clinicId, patient_id: patientId, visit_id: visit.id, pulse: 72 });
  if (unrecorded) throw unrecorded;
  // And its prescription, with a medicine on it (0021).
  const { data: prescription, error: unprescribed } = await admin()
    .from("prescriptions")
    .insert({ clinic_id: a.clinicId, patient_id: patientId, visit_id: visit.id, doctor_id: doctorId })
    .select("id")
    .single();
  if (unprescribed) throw unprescribed;
  const { error: unlisted } = await admin()
    .from("prescription_items")
    .insert({ clinic_id: a.clinicId, prescription_id: prescription.id, position: 1, medicine: "Amoxicillin" });
  if (unlisted) throw unlisted;
  // And a template of A's doctor, with a medicine (0023).
  const { data: template, error: untemplated } = await admin()
    .from("prescription_templates")
    .insert({ clinic_id: a.clinicId, doctor_id: doctorId, name: "Viral fever" })
    .select("id")
    .single();
  if (untemplated) throw untemplated;
  templateId = template.id as string;
  const { error: unlined } = await admin()
    .from("prescription_template_items")
    .insert({ clinic_id: a.clinicId, template_id: templateId, position: 1, medicine: "Paracetamol" });
  if (unlined) throw unlined;
  // And a treatment begun in that visit, which is its first session (0024).
  const { data: treatment, error: untreated } = await admin()
    .from("treatments")
    .insert({
      clinic_id: a.clinicId,
      patient_id: patientId,
      doctor_id: doctorId,
      name: "Root canal",
      status: "IN_PROGRESS",
      started_visit_id: visitId,
    })
    .select("id")
    .single();
  if (untreated) throw untreated;
  treatmentId = treatment.id as string;
  const { data: session, error: unsessioned } = await admin()
    .from("treatment_sessions")
    .insert({ clinic_id: a.clinicId, treatment_id: treatmentId, visit_id: visitId, note: "Access opened" })
    .select("id")
    .single();
  if (unsessioned) throw unsessioned;
  sessionId = session.id as string;
  // And a call noted about the visit's follow-up (0026) — closed by the appointment tomorrow, so on no list.
  await admin()
    .from("visits")
    .update({ follow_up_on: addDaysKey(todayKey(), 7) })
    .eq("id", visitId);
  const { error: uncalled } = await admin()
    .from("follow_up_contacts")
    .insert({ clinic_id: a.clinicId, patient_id: patientId, visit_id: visitId, outcome: "REACHED" });
  if (uncalled) throw uncalled;
  // And a bill for that visit, issued while it is open (0028), with its line and its number.
  const { data: consultation } = await admin()
    .from("services")
    .select("id")
    .eq("clinic_id", a.clinicId)
    .eq("name", "Consultation")
    .single();
  const { data: bill, error: unbilled } = await a.owner.tenant.supabase.rpc("create_bill", {
    p_bill: {
      patient_id: patientId,
      visit_id: visitId,
      items: [{ service_id: consultation!.id, quantity: 1, unit_price_paise: 0 }],
      subtotal_paise: 0,
      total_paise: 0,
    },
    p_idempotency_key: randomUUID(),
  });
  if (unbilled) throw unbilled;
  billId = (bill as { bill_id: string }).bill_id;
  developer = await makeDeveloper();
});

afterAll(removeAll);

describe("as clinic B's owner, with a valid token", () => {
  it("reads none of A's rows, in any table that belongs to a clinic", async () => {
    for (const { table, column } of CLINIC_TABLES) {
      const { data, error } = await b.owner.tenant.supabase.from(table).select("*").eq(column, a.clinicId);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it("reads none of A's people", async () => {
    const { data } = await b.owner.tenant.supabase.from("profiles").select("id").eq("id", a.owner.userId);
    expect(data).toEqual([]);
  });

  it("reads its own clinic, and A's owner reads A's", async () => {
    for (const { table, column } of CLINIC_TABLES.filter(({ table }) => table !== "subscription_payments")) {
      const { data } = await a.owner.tenant.supabase.from(table).select("*").eq(column, a.clinicId);
      expect(data!.length, table).toBeGreaterThan(0);
    }
  });

  it("writes nothing into A's clinic", async () => {
    const { error: insert } = await b.owner.tenant.supabase
      .from("services")
      .insert({ clinic_id: a.clinicId, name: "Planted", category: "OTHER", price_paise: 100 });
    expect(insert?.code).toBe("42501");

    const { data: updated } = await b.owner.tenant.supabase
      .from("services")
      .update({ price_paise: 1 })
      .eq("clinic_id", a.clinicId)
      .select("id");
    expect(updated).toEqual([]);

    const { data: renamed } = await b.owner.tenant.supabase
      .from("patients")
      .update({ full_name: "Planted" })
      .eq("clinic_id", a.clinicId)
      .select("id");
    expect(renamed).toEqual([]);

    const { data: moved } = await b.owner.tenant.supabase
      .from("services")
      .update({ clinic_id: a.clinicId })
      .eq("clinic_id", b.clinicId)
      .select("id");
    expect(moved ?? []).toEqual([]);
  });

  it("finds none of A's patients, and writes nothing onto one", async () => {
    const { supabase } = b.owner.tenant;
    const { data: found } = await supabase.rpc("search_patients", {
      p_words: "Rohan",
      p_digits: "9876543210",
      p_number: null,
      p_archived: false,
      p_offset: 0,
      p_limit: 20,
    });
    expect(found).toEqual([]);
    const { data: seen } = await supabase.rpc("can_see_patient", { p_patient_id: patientId });
    expect(seen).toBe(false);

    const { error: planted } = await supabase
      .from("patient_alerts")
      .insert({ clinic_id: a.clinicId, patient_id: patientId, kind: "ALLERGY", label: "Planted" });
    expect(planted?.code).toBe("42501");
    const { error: crossed } = await supabase
      .from("patient_alerts")
      .insert({ clinic_id: b.clinicId, patient_id: patientId, kind: "ALLERGY", label: "Crossed" });
    // Its own clinic named, the patient is still not its own: the composite key refuses it.
    expect(crossed?.code).toBe("23503");
    const { data: archived } = await supabase
      .from("patients")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", patientId)
      .select("id");
    expect(archived).toEqual([]);
  });

  it("finds none of A's appointments to change or move in the queue, and books none onto A's patient", async () => {
    const { supabase } = b.owner.tenant;
    for (const [name, args] of [
      ["change_appointment_status", { p_appointment_id: appointmentId, p_status: "CANCELLED", p_reason: "Planted" }],
      ["mark_arrived", { p_appointment_id: appointmentId }],
      ["update_appointment", { p_appointment_id: appointmentId, p_changes: { notes: "Planted" } }],
      ["send_in", { p_appointment_id: appointmentId, p_others: "FINISH" }],
      ["mark_done", { p_appointment_id: appointmentId }],
      ["back_to_waiting", { p_appointment_id: appointmentId }],
      ["mark_stepped_out", { p_appointment_id: appointmentId, p_out: true }],
      ["mark_urgent", { p_appointment_id: appointmentId, p_urgent: true }],
      ["next_patient", { p_doctor_id: doctorId, p_appointment_id: appointmentId }],
      ["next_patient", { p_doctor_id: doctorId }],
    ] as const) {
      const { error } = await supabase.rpc(name, args);
      expect(error?.hint, name).toBe("RECORD_NOT_FOUND");
    }
    const { error: booked } = await supabase.rpc("create_appointment", {
      p_appointment: { patient_id: patientId, scheduled_at: dayHour(addDaysKey(todayKey(), 2), 10) },
      p_idempotency_key: randomUUID(),
    });
    expect(booked?.hint).toBe("RECORD_NOT_FOUND");
  });

  it("finds none of A's visits to record into or close, and starts none on A's patient (0020)", async () => {
    const { supabase } = b.owner.tenant;
    for (const [name, args] of [
      ["save_vitals", { p_visit_id: visitId, p_appointment_id: null, p_vitals: { pulse: 99 }, p_seen: { pulse: 72 } }],
      ["save_vitals", { p_visit_id: null, p_appointment_id: appointmentId, p_vitals: { pulse: 99 }, p_seen: null }],
      ["update_visit", { p_visit_id: visitId, p_changes: { notes: "Planted" }, p_seen: { notes: null } }],
      ["start_visit", { p_patient_id: patientId, p_doctor_id: doctorId }],
      ["finish_visit", { p_visit_id: visitId }],
    ] as const) {
      const { error } = await supabase.rpc(name, args);
      expect(error?.hint, name).toBe("RECORD_NOT_FOUND");
    }
  });

  it("finds none of A's visits to prescribe on, and none of A's medicines among its suggestions (0021)", async () => {
    const { supabase } = b.owner.tenant;
    const { error } = await supabase.rpc("save_prescription", {
      p_visit_id: visitId,
      p_prescription: { items: [{ medicine: "Planted" }], advice: null, print_diagnosis: false },
      p_seen: null,
    });
    expect(error?.hint).toBe("RECORD_NOT_FOUND");
    // B's owner holds every permission and sees patients, so the suggestions answer — with nothing of A's.
    const { data, error: unsuggested } = await supabase.rpc("medicine_suggestions", {
      p_search: "Amox",
      p_doctor_id: doctorId,
    });
    expect(unsuggested).toBeNull();
    expect(data).toEqual([]);
    const { data: own } = await a.owner.tenant.supabase.rpc("medicine_suggestions", {
      p_search: "Amox",
      p_doctor_id: doctorId,
    });
    expect(own).toMatchObject([{ medicine: "Amoxicillin" }]);
  });

  it("changes none of A's prescription templates, and makes none in A's doctor's name (0023)", async () => {
    const { supabase } = b.owner.tenant;
    const { error } = await supabase.rpc("save_prescription_template", {
      p_template_id: templateId,
      p_template: { name: "Planted", items: [{ medicine: "Planted" }], advice: null },
      p_replace: false,
    });
    expect(error?.hint).toBe("RECORD_NOT_FOUND");
    const { data: archived } = await supabase
      .from("prescription_templates")
      .update({ active: false })
      .eq("id", templateId)
      .select("id");
    expect(archived ?? []).toEqual([]);
    // B's owner's own template is B's, whatever A's doctor is called.
    const { data: own, error: unowned } = await supabase.rpc("save_prescription_template", {
      p_template_id: null,
      p_template: { name: "Viral fever", items: [{ medicine: "Dolo" }], advice: null },
      p_replace: false,
    });
    expect(unowned).toBeNull();
    const { data: row } = await admin()
      .from("prescription_templates")
      .select("clinic_id")
      .eq("id", (own as { template_id: string }).template_id)
      .single();
    expect(row).toEqual({ clinic_id: b.clinicId });
    const { data: theirs } = await admin()
      .from("prescription_templates")
      .select("name, active")
      .eq("id", templateId)
      .single();
    expect(theirs).toEqual({ name: "Viral fever", active: true });
  });

  it("finds none of A's treatments or sessions to change, and starts none on A's patient or visit (0024)", async () => {
    const { supabase } = b.owner.tenant;
    for (const [name, args] of [
      ["create_treatment", { p_treatment: { name: "Planted", status: "PLANNED" }, p_visit_id: visitId }],
      [
        "create_treatment",
        {
          p_treatment: { patient_id: patientId, doctor_id: doctorId, name: "Planted", status: "PLANNED" },
          p_visit_id: null,
        },
      ],
      [
        "update_treatment",
        { p_treatment_id: treatmentId, p_changes: { name: "Planted" }, p_seen: { name: "Root canal" } },
      ],
      ["change_treatment_status", { p_treatment_id: treatmentId, p_status: "CANCELLED", p_seen: "IN_PROGRESS" }],
      [
        "record_treatment_session",
        { p_treatment_id: treatmentId, p_visit_id: visitId, p_note: "Planted", p_seen: { note: "Access opened" } },
      ],
      ["remove_treatment_session", { p_treatment_id: treatmentId, p_visit_id: visitId }],
    ] as const) {
      const { error } = await supabase.rpc(name, args);
      expect(error?.hint, name).toBe("RECORD_NOT_FOUND");
    }
    const { data: kept } = await admin().from("treatments").select("name, status").eq("id", treatmentId).single();
    expect(kept).toEqual({ name: "Root canal", status: "IN_PROGRESS" });
    const { data: note } = await admin().from("treatment_sessions").select("note").eq("id", sessionId).single();
    expect(note).toEqual({ note: "Access opened" });
  });

  it("lists none of A's follow-ups, and notes no call about one (0026)", async () => {
    const { supabase } = b.owner.tenant;
    for (const tab of ["TODAY", "OVERDUE", "UPCOMING", "LAPSED", "COMPLETED"]) {
      const { data, error } = await supabase.rpc("follow_up_items", { p_tab: tab, p_offset: 0, p_limit: 100 });
      expect(error, tab).toBeNull();
      expect(data, tab).toEqual([]);
    }
    for (const contact of [{ visit_id: visitId }, { treatment_id: treatmentId }]) {
      const { error } = await supabase.rpc("record_follow_up_contact", {
        p_contact: { ...contact, outcome: "REACHED" },
      });
      expect(error?.hint).toBe("RECORD_NOT_FOUND");
    }
  });

  it("bills none of A's patients or visits, voids none of A's bills, and marks none of A's visits No charge (0028)", async () => {
    const { supabase } = b.owner.tenant;
    const { data: theirs } = await admin()
      .from("services")
      .select("id")
      .eq("clinic_id", b.clinicId)
      .eq("name", "Consultation")
      .single();
    const line = { service_id: theirs!.id, quantity: 1, unit_price_paise: 0 };
    for (const [name, args] of [
      [
        "create_bill",
        {
          p_bill: { patient_id: patientId, items: [line], subtotal_paise: 0, total_paise: 0 },
          p_idempotency_key: randomUUID(),
        },
      ],
      ["void_bill", { p_bill_id: billId, p_reason: "Planted" }],
      ["mark_no_charge", { p_visit_id: visitId, p_reason: "COURTESY", p_note: null }],
    ] as const) {
      const { error } = await supabase.rpc(name, args);
      expect(error?.hint, name).toBe("RECORD_NOT_FOUND");
    }
    const { data: kept } = await admin().from("bills").select("status").eq("id", billId).single();
    expect(kept).toEqual({ status: "ISSUED" });
  });

  it("prints none of A's prescriptions (R6.4)", async () => {
    await expect(
      getPrescriptionPdf(b.owner.tenant, visitId, { download: false, requestId: "req_test" }),
    ).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
  });

  it("reaches none of the platform's tables, nor those only the database reads", async () => {
    for (const table of [...PLATFORM_TABLES, ...DATABASE_TABLES]) {
      const { error } = await b.owner.tenant.supabase.from(table).select("*").limit(1);
      expect(error?.code, table).toBe("42501");
    }
  });

  it("calls none of the server's or the admin's functions", async () => {
    const { error: registered } = await b.owner.tenant.supabase.rpc("register_clinic", {
      p_user_id: b.owner.userId,
      p_full_name: "x",
      p_email: "x@y.co",
      p_phone: null,
      p_sees_patients: false,
      p_clinic_name: "x",
      p_clinic_type: "OTHER",
      p_city: "x",
      p_address: "x",
      p_clinic_phone: null,
      p_mobile_hmac: "0".repeat(64),
    });
    expect(registered?.code).toBe("42501");

    const { error: cleaned } = await b.owner.tenant.supabase.rpc("clean_up_logs");
    expect(cleaned?.code).toBe("42501");

    const { error: extended } = await b.owner.tenant.supabase.rpc("extend_clinic_subscription", {
      p_clinic_id: b.clinicId,
      p_kind: "YEARLY",
      p_amount_paise: 0,
      p_method: null,
      p_reference: null,
      p_paid_on: null,
      p_valid_until: null,
      p_reason: null,
    });
    expect(extended?.code).toBe("42501");

    const { error: settings } = await b.owner.tenant.supabase.rpc("update_platform_settings", {
      p_changes: { grace_days: 60 },
    });
    expect(settings?.code).toBe("42501");
  });
});

describe("as the platform admin (DEV)", () => {
  it("reads no clinic's rows with their own token (plan §20)", async () => {
    const supabase = createClient(
      getServerEnv().NEXT_PUBLIC_SUPABASE_URL,
      getServerEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${developer.session.accessToken}` } },
      },
    );
    for (const { table } of CLINIC_TABLES) {
      const { data } = await supabase.from(table).select("*").limit(5);
      expect(data, table).toEqual([]);
    }
  });

  it("belongs to no clinic: a membership for them is refused, and a member is never made DEV", async () => {
    const { error } = await admin().from("clinic_members").insert({
      clinic_id: a.clinicId,
      user_id: developer.userId,
      role: "STAFF",
      status: "ACTIVE",
      joined_at: "now()",
    });
    expect(error?.code).toBe("23514");

    const { error: promoted } = await admin()
      .from("profiles")
      .update({ platform_role: "DEV" })
      .eq("id", b.owner.userId);
    expect(promoted?.code).toBe("23514");
  });
});

describe("signed out, with only the public key", () => {
  it("reads and writes nothing at all", async () => {
    const env = getServerEnv();
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    for (const table of [
      ...CLINIC_TABLES.map(({ table }) => table),
      "profiles",
      ...PLATFORM_TABLES,
      ...DATABASE_TABLES,
    ]) {
      const { error } = await anon.from(table).select("*").limit(1);
      expect(error?.code, table).toBe("42501");
    }
    const { error } = await anon.rpc("current_clinic_id");
    expect(error?.code).toBe("42501");
  });
});
