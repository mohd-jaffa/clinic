// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isOpen, listPatientTreatments, toTreatment, TREATMENT_COLUMNS } from "@/features/treatments/api";
import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";
import { aTreatment, aTreatmentRow } from "@tests/support/treatments";

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  return { ...fake, tenant: { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1" } as Tenant };
}

describe("toTreatment (plan §14.1, D261)", () => {
  it("reads a treatment, its doctor and its sessions in the order they were recorded", () => {
    const later = {
      id: "s-2",
      visit_id: "v-1",
      note: null,
      created_at: "2026-10-19T05:00:00+00:00",
      visit: { visit_date: "2026-10-19", doctor: null },
    };
    expect(toTreatment(aTreatmentRow({ sessions: [later, ...aTreatmentRow().sessions] }))).toEqual(
      aTreatment({
        sessions: [
          ...aTreatment().sessions,
          { id: "s-2", visitId: "v-1", day: "2026-10-19", doctorName: null, note: null },
        ],
      }),
    );
  });

  it("names no doctor once they are gone, takes a session's day from when it was made without its visit, and the day it was cancelled", () => {
    const read = toTreatment(
      aTreatmentRow({
        doctor: null,
        status: "CANCELLED",
        cancel_reason: "Declined",
        cancelled_at: "2026-10-13T20:00:00+00:00",
        sessions: [{ id: "s-1", visit_id: "v-0", note: null, created_at: "2026-10-12T05:00:00+00:00", visit: null }],
      }),
    );
    expect(read).toMatchObject({ doctorName: null, cancelReason: "Declined", cancelledOn: "2026-10-14" });
    expect(read.sessions[0]).toMatchObject({ day: "2026-10-12", doctorName: null });
  });
});

describe("isOpen", () => {
  it("is planned, in progress or on hold", () => {
    expect(["PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => isOpen(s as never))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });
});

describe("listPatientTreatments (D260)", () => {
  it("reads a patient's treatments in one query, oldest first", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: [aTreatmentRow()] }) });
    expect(await listPatientTreatments(tenant, "p-1")).toEqual([aTreatment()]);
    expect(queries).toHaveLength(1);
    expect(argsOf(queries[0], "select")[0]).toEqual([TREATMENT_COLUMNS]);
    expect(argsOf(queries[0], "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["patient_id", "p-1"],
    ]);
    expect(argsOf(queries[0], "order")).toEqual([["created_at", { ascending: true }]]);
    expect(TREATMENT_COLUMNS).toContain("sessions:treatment_sessions!treatment_sessions_treatment_id_clinic_id_fkey(");
  });

  it("passes a failure on", async () => {
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("XX000") }) });
    await expect(listPatientTreatments(tenant, "p-1")).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });
});
