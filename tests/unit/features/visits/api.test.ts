// @vitest-environment node
import { describe, expect, it } from "vitest";

import { getVisit } from "@/features/visits/api";
import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

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
  patient: {
    full_name: "Asha Iyer",
    patient_number: 1012,
    date_of_birth: "1990-04-12",
    gender: "FEMALE",
    archived_at: null,
    alerts: [
      { id: "al-1", kind: "MEDICATION", label: "Metformin", note: null, active: true },
      { id: "al-2", kind: "ALLERGY", label: "Penicillin", note: "Rash", active: true },
      { id: "al-3", kind: "CONDITION", label: "Asthma", note: null, active: false },
    ],
  },
  doctor: { member: { profile: { full_name: "Maya Rao" } } },
  appointment: { status: "IN_PROGRESS", token_number: 7 },
};

describe("getVisit (plan §12.2, D195)", () => {
  it("reads the header in one query: the patient, the doctor, the token, and active alerts with allergies first", async () => {
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
        dateOfBirth: "1990-04-12",
        gender: "FEMALE",
        archived: false,
      },
      doctorId: "d-1",
      doctorName: "Maya Rao",
      appointment: { id: "a-1", status: "IN_PROGRESS", token: 7 },
      alerts: [
        { id: "al-2", kind: "ALLERGY", label: "Penicillin", note: "Rash", active: true },
        { id: "al-1", kind: "MEDICATION", label: "Metformin", note: null, active: true },
      ],
    });
    expect(queries).toHaveLength(1);
    expect(argsOf(queries[0], "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["id", "v-1"],
    ]);
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
      patient: { archived: true },
    });
  });

  it("finds none it may not read, and says why it could not", async () => {
    await expect(getVisit(tenantWith({}).tenant, "v-9")).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("42501") }) });
    await expect(getVisit(tenant, "v-1")).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});
