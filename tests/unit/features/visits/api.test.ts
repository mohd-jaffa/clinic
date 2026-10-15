// @vitest-environment node
import { describe, expect, it } from "vitest";

import { getVisit, listPatientVisits } from "@/features/visits/api";
import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";
import { aTreatment, aTreatmentRow } from "@tests/support/treatments";

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  return { ...fake, tenant: { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1" } as Tenant };
}

const row = {
  id: "v-1",
  patient_id: "p-1",
  doctor_id: "d-1",
  appointment_id: "a-1",
  status: "OPEN",
  visit_date: "2026-10-13",
  started_at: "2026-10-13T05:00:00+00:00",
  completed_at: null,
  billing_status: null,
  complaint: "Fever, 3 days",
  diagnosis: null,
  notes: "Rest",
  follow_up_on: "2026-10-20",
  patient: {
    full_name: "Asha Iyer",
    patient_number: 1012,
    phone: "+919876543210",
    date_of_birth: "1990-04-12",
    gender: "FEMALE",
    archived_at: null,
    alerts: [
      { id: "al-1", kind: "MEDICATION", label: "Metformin", note: null, active: true },
      { id: "al-2", kind: "ALLERGY", label: "Penicillin", note: "Rash", active: true },
      { id: "al-3", kind: "CONDITION", label: "Asthma", note: null, active: false },
    ],
  },
  doctor: { registration_number: "KMC 12345", member: { user_id: "user-maya", profile: { full_name: "Maya Rao" } } },
  appointment: { status: "IN_PROGRESS", token_number: 7, urgent_at: "2026-10-13T04:55:00Z" },
  vitals: {
    systolic: 120,
    diastolic: 80,
    pulse: null,
    temperature_f: 98.6,
    spo2: null,
    respiratory_rate: null,
    weight_kg: 64.5,
    height_cm: null,
  },
  prescription: null,
  previous: null,
  treatments: [],
};

/** Two medicines as PostgREST embeds them, out of their places, and who typed them. */
const embedded = (entered_by: string | null, typist: { full_name: string } | null = { full_name: "Priya Nair" }) => ({
  id: "rx-1",
  advice: "Plenty of fluids",
  print_diagnosis: true,
  entered_by,
  typist,
  items: [
    {
      position: 2,
      medicine: "Cetirizine",
      strength: "10 mg",
      dose: null,
      frequency: "0-0-1",
      timing: "BEDTIME",
      duration_days: null,
      instructions: null,
    },
    {
      position: 1,
      medicine: "Paracetamol",
      strength: "500 mg",
      dose: "1 tab",
      frequency: "1-0-1",
      timing: "AFTER_FOOD",
      duration_days: 5,
      instructions: "Dissolve in water",
    },
  ],
});

const read = {
  systolic: 120,
  diastolic: 80,
  pulse: null,
  temperatureF: 98.6,
  spo2: null,
  respiratoryRate: null,
  weightKg: 64.5,
  heightCm: null,
};

describe("getVisit (plan §12.2, D195, D202)", () => {
  it("reads the visit in one query: what it records, the patient, the doctor, the token, its vitals, and active alerts with allergies first", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: row }) });
    expect(await getVisit(tenant, "v-1")).toEqual({
      id: "v-1",
      status: "OPEN",
      billingStatus: null,
      day: "2026-10-13",
      startedAt: "2026-10-13T05:00:00+00:00",
      completedAt: null,
      patient: {
        id: "p-1",
        name: "Asha Iyer",
        number: 1012,
        phone: "+919876543210",
        dateOfBirth: "1990-04-12",
        gender: "FEMALE",
        archived: false,
      },
      doctorId: "d-1",
      doctorName: "Maya Rao",
      doctorRegistration: "KMC 12345",
      appointment: { id: "a-1", status: "IN_PROGRESS", token: 7, urgentAt: "2026-10-13T04:55:00Z" },
      alerts: [
        { id: "al-2", kind: "ALLERGY", label: "Penicillin", note: "Rash", active: true },
        { id: "al-1", kind: "MEDICATION", label: "Metformin", note: null, active: true },
      ],
      complaint: "Fever, 3 days",
      diagnosis: null,
      notes: "Rest",
      followUpOn: "2026-10-20",
      vitals: read,
      prescription: null,
      previousPrescription: null,
      treatments: [],
    });
    expect(queries).toHaveLength(1);
    const [columns] = argsOf(queries[0], "select")[0] as [string];
    expect(columns).toContain("complaint, diagnosis, notes, follow_up_on");
    expect(columns).toContain(
      "vitals:vitals!vitals_visit_id_clinic_id_fkey(systolic, diastolic, pulse, temperature_f, spo2, respiratory_rate, weight_kg, height_cm)",
    );
    expect(columns).toContain("doctor:doctors!visits_doctor_id_clinic_id_fkey(registration_number, ");
    expect(columns).toContain(
      "prescription:prescriptions!prescriptions_visit_id_clinic_id_fkey(id, advice, print_diagnosis, entered_by, ",
    );
    expect(columns).toContain("typist:profiles!prescriptions_entered_by_fkey(full_name)");
    expect(columns).toContain(
      "items:prescription_items(position, medicine, strength, dose, frequency, timing, duration_days, instructions)",
    );
    expect(columns).toContain("previous:previous_prescription");
    expect(argsOf(queries[0], "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["id", "v-1"],
    ]);
  });

  it("reads the patient's prescription before it, for Repeat (D236)", async () => {
    const previous = {
      day: "2026-10-06",
      doctor_name: "Ravi Kumar",
      advice: "Rest",
      items: [
        {
          medicine: "Paracetamol",
          strength: "500 mg",
          dose: null,
          frequency: null,
          timing: null,
          duration_days: 3,
          instructions: null,
        },
      ],
    };
    const { tenant } = tenantWith({ answer: () => ({ data: { ...row, previous } }) });
    expect((await getVisit(tenant, "v-1")).previousPrescription).toEqual({
      day: "2026-10-06",
      doctorName: "Ravi Kumar",
      advice: "Rest",
      items: [
        {
          medicine: "Paracetamol",
          strength: "500 mg",
          dose: null,
          frequency: null,
          timing: null,
          durationDays: 3,
          instructions: null,
        },
      ],
    });
  });

  it("reads one with no appointment, an archived patient and a doctor gone", async () => {
    const { tenant } = tenantWith({
      answer: () => ({
        data: {
          ...row,
          appointment_id: null,
          appointment: null,
          doctor: null,
          patient: { ...row.patient, archived_at: "2026-10-12T00:00:00Z" },
        },
      }),
    });
    expect(await getVisit(tenant, "v-1")).toMatchObject({
      appointment: null,
      doctorName: null,
      doctorRegistration: null,
      patient: { archived: true },
    });
  });

  it("reads its vitals however they are embedded — one row, a list of one, an empty list — and none before any are taken", async () => {
    const asListed = tenantWith({ answer: () => ({ data: { ...row, vitals: [row.vitals] } }) });
    expect((await getVisit(asListed.tenant, "v-1")).vitals).toEqual(read);
    const empty = tenantWith({ answer: () => ({ data: { ...row, vitals: [] } }) });
    expect((await getVisit(empty.tenant, "v-1")).vitals).toBeNull();
    const none = tenantWith({ answer: () => ({ data: { ...row, vitals: null, started_at: null } }) });
    expect(await getVisit(none.tenant, "v-1")).toMatchObject({ vitals: null, startedAt: null });
  });

  it("reads its prescription with its medicines in their places, however it is embedded (plan §13)", async () => {
    const one = tenantWith({ answer: () => ({ data: { ...row, prescription: embedded("user-maya") } }) });
    expect((await getVisit(one.tenant, "v-1")).prescription).toEqual({
      id: "rx-1",
      items: [
        {
          medicine: "Paracetamol",
          strength: "500 mg",
          dose: "1 tab",
          frequency: "1-0-1",
          timing: "AFTER_FOOD",
          durationDays: 5,
          instructions: "Dissolve in water",
        },
        {
          medicine: "Cetirizine",
          strength: "10 mg",
          dose: null,
          frequency: "0-0-1",
          timing: "BEDTIME",
          durationDays: null,
          instructions: null,
        },
      ],
      advice: "Plenty of fluids",
      printDiagnosis: true,
      typedBy: null,
    });
    const listed = tenantWith({ answer: () => ({ data: { ...row, prescription: [embedded("user-maya")] } }) });
    expect((await getVisit(listed.tenant, "v-1")).prescription?.id).toBe("rx-1");
    const empty = tenantWith({ answer: () => ({ data: { ...row, prescription: [] } }) });
    expect((await getVisit(empty.tenant, "v-1")).prescription).toBeNull();
  });

  it("names who typed it only when that was not the doctor (D45)", async () => {
    const typed = tenantWith({ answer: () => ({ data: { ...row, prescription: embedded("user-priya") } }) });
    expect((await getVisit(typed.tenant, "v-1")).prescription?.typedBy).toBe("Priya Nair");
    const gone = tenantWith({ answer: () => ({ data: { ...row, prescription: embedded("user-priya", null) } }) });
    expect((await getVisit(gone.tenant, "v-1")).prescription?.typedBy).toBeNull();
    const nobody = tenantWith({ answer: () => ({ data: { ...row, prescription: embedded(null, null) } }) });
    expect((await getVisit(nobody.tenant, "v-1")).prescription?.typedBy).toBeNull();
    // With the doctor's account gone, anyone who typed it is named.
    const doctorGone = tenantWith({
      answer: () => ({
        data: {
          ...row,
          doctor: { registration_number: "KMC 12345", member: null },
          prescription: embedded("user-maya"),
        },
      }),
    });
    expect(await getVisit(doctorGone.tenant, "v-1")).toMatchObject({
      doctorName: null,
      doctorRegistration: "KMC 12345",
      prescription: { typedBy: "Priya Nair" },
    });
  });

  it("finds none it may not read, and says why it could not", async () => {
    await expect(getVisit(tenantWith({}).tenant, "v-9")).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("42501") }) });
    await expect(getVisit(tenant, "v-1")).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("getVisit's treatments (D256)", () => {
  it("reads them with the visit, each with its sessions, through visit_treatments", async () => {
    const { tenant, queries, argsOf } = tenantWith({
      answer: () => ({ data: { ...row, treatments: [aTreatmentRow()] } }),
    });
    expect((await getVisit(tenant, "v-1")).treatments).toEqual([aTreatment()]);
    const [columns] = argsOf(queries[0], "select")[0] as [string];
    expect(columns).toContain("treatments:visit_treatments(id, patient_id, doctor_id, name, ");
  });
});

describe("listPatientVisits (plan §10.3; D225, D226)", () => {
  const visit = {
    id: "v-1",
    status: "COMPLETED",
    visit_date: "2026-10-14",
    created_at: "2026-10-14T05:00:00.123456+00:00",
    complaint: "Toothache",
    diagnosis: "Dental caries",
    recorded: true,
    doctor: { member: { profile: { full_name: "Maya Rao" } } },
    prescription: {
      items: [
        { position: 2, medicine: "Amoxicillin" },
        { position: 1, medicine: "Paracetamol" },
      ],
    },
    worked: [],
    begun: [],
  };

  it("reads a page and one more of a patient's visits, newest first, each with what it found and its medicines", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: [visit] }) });
    expect(await listPatientVisits(tenant, "p-1")).toEqual([
      {
        id: "v-1",
        status: "COMPLETED",
        day: "2026-10-14",
        openedAt: "2026-10-14T05:00:00.123456+00:00",
        doctorName: "Maya Rao",
        finding: "Dental caries",
        medicines: ["Paracetamol", "Amoxicillin"],
        treatments: [],
        recorded: true,
      },
    ]);
    expect(queries[0].table).toBe("visits");
    expect(argsOf(queries[0], "select")[0][0]).toContain("recorded:visit_recorded");
    expect(argsOf(queries[0], "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["patient_id", "p-1"],
    ]);
    expect(argsOf(queries[0], "order")).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(argsOf(queries[0], "range")).toEqual([[0, 20]]);
  });

  it("says the complaint when there is no diagnosis; no medicines without a prescription; no doctor once gone", async () => {
    const { tenant } = tenantWith({
      answer: () => ({
        data: [
          { ...visit, diagnosis: null, doctor: null, prescription: null },
          {
            ...visit,
            id: "v-2",
            complaint: null,
            diagnosis: null,
            recorded: false,
            doctor: { member: null },
            prescription: [],
          },
          { ...visit, id: "v-3", prescription: [{ items: [{ position: 1, medicine: "Ibuprofen" }] }] },
        ],
      }),
    });
    const [complaint, empty, listed] = await listPatientVisits(tenant, "p-1");
    expect(complaint).toMatchObject({ finding: "Toothache", doctorName: null, medicines: [] });
    expect(empty).toMatchObject({ finding: null, doctorName: null, medicines: [], recorded: false });
    expect(listed.medicines).toEqual(["Ibuprofen"]);
  });

  it("names the treatments it worked on or began, each once, as they were begun (D262)", async () => {
    const crown = { id: "t-2", name: "Crown", created_at: "2026-10-14T06:00:00+00:00" };
    const canal = { id: "t-1", name: "Root canal", created_at: "2026-10-01T05:00:00+00:00" };
    const { tenant, queries, argsOf } = tenantWith({
      answer: () => ({
        data: [{ ...visit, begun: [crown], worked: [{ treatment: crown }, { treatment: canal }, { treatment: null }] }],
      }),
    });
    expect((await listPatientVisits(tenant, "p-1"))[0].treatments).toEqual(["Root canal", "Crown"]);
    const [columns] = argsOf(queries[0], "select")[0] as [string];
    expect(columns).toContain("worked:treatment_sessions!treatment_sessions_visit_id_clinic_id_fkey(");
    expect(columns).toContain("begun:treatments!treatments_started_visit_id_clinic_id_fkey(id, name, created_at)");
  });

  it("reads on from where the page before ended, and says why it could not read", async () => {
    const page = tenantWith({ answer: () => ({ data: [] }) });
    await listPatientVisits(page.tenant, "p-1", 20);
    expect(page.argsOf(page.queries[0], "range")).toEqual([[20, 40]]);
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("42501") }) });
    await expect(listPatientVisits(tenant, "p-1")).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});
