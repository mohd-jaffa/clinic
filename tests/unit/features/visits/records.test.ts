// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionsSafe } = vi.hoisted(() => ({ logActionsSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionsSafe }));

const { finishVisit, saveVitals, startVisit, updateVisit } = await import("@/features/visits/records");

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant = { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1" } as Tenant;
  return { ...fake, tenant };
}

const NONE = {
  systolic: null,
  diastolic: null,
  pulse: null,
  temperatureF: null,
  spo2: null,
  respiratoryRate: null,
  weightKg: null,
  heightCm: null,
};
const NO_ROW = {
  systolic: null,
  diastolic: null,
  pulse: null,
  temperature_f: null,
  spo2: null,
  respiratory_rate: null,
  weight_kg: null,
  height_cm: null,
};
const refused = (hint: string) => ({ error: { ...postgrestError("P0001"), hint } });

beforeEach(() => vi.clearAllMocks());

describe("saveVitals (D202, D203, D206)", () => {
  it("takes a visit's first readings through save_vitals, audited as made with the readings' names", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({
        data: {
          visit_id: "v-1",
          opened: false,
          vitals_id: "vt-1",
          before: null,
          after: { ...NO_ROW, systolic: 120, diastolic: 80, temperature_f: 98.6 },
        },
      }),
    });
    expect(
      await saveVitals(
        tenant,
        { visitId: "v-1" },
        { vitals: { ...NONE, systolic: 120, diastolic: 80, temperatureF: 98.6 }, seen: null },
        "req_v",
      ),
    ).toEqual({ visitId: "v-1", vitals: { ...NONE, systolic: 120, diastolic: 80, temperatureF: 98.6 } });
    expect(rpcs).toEqual([
      {
        name: "save_vitals",
        args: {
          p_visit_id: "v-1",
          p_appointment_id: null,
          p_vitals: { ...NO_ROW, systolic: 120, diastolic: 80, temperature_f: 98.6 },
          p_seen: null,
        },
      },
    ]);
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "CREATE",
        entityType: "vitals",
        entityId: "vt-1",
        changes: { fields: ["systolic", "diastolic", "temperature_f"] },
        requestId: "req_v",
      },
    ]);
  });

  it("takes a waiting patient's through their appointment, from the copy read — audited with the visit they opened", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({
        data: {
          visit_id: "v-2",
          opened: true,
          vitals_id: "vt-2",
          before: { ...NO_ROW, pulse: 70 },
          after: { ...NO_ROW, pulse: 72, weight_kg: 58 },
        },
      }),
    });
    await saveVitals(
      tenant,
      { appointmentId: "a-1" },
      { vitals: { ...NONE, pulse: 72, weightKg: 58 }, seen: { ...NONE, pulse: 70 } },
      "req_w",
    );
    expect(rpcs[0].args).toEqual({
      p_visit_id: null,
      p_appointment_id: "a-1",
      p_vitals: { ...NO_ROW, pulse: 72, weight_kg: 58 },
      p_seen: { ...NO_ROW, pulse: 70 },
    });
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "CREATE",
        entityType: "visits",
        entityId: "v-2",
        changes: { status: { from: null, to: "OPEN" } },
        requestId: "req_w",
      },
      {
        action: "UPDATE",
        entityType: "vitals",
        entityId: "vt-2",
        changes: { fields: ["pulse", "weight_kg"] },
        requestId: "req_w",
      },
    ]);
  });

  it("audits nothing when nothing changed, and says why it was refused", async () => {
    const same = tenantWith({
      rpc: () => ({
        data: {
          visit_id: "v-1",
          opened: false,
          vitals_id: "vt-1",
          before: { ...NO_ROW, spo2: 98 },
          after: { ...NO_ROW, spo2: 98 },
        },
      }),
    });
    await saveVitals(same.tenant, { visitId: "v-1" }, { vitals: { ...NONE, spo2: 98 }, seen: { ...NONE, spo2: 98 } });
    expect(logActionsSafe).toHaveBeenCalledWith(same.tenant, []);

    const { tenant } = tenantWith({ rpc: () => refused("VISIT_CHANGED") });
    await expect(saveVitals(tenant, { visitId: "v-1" }, { vitals: NONE, seen: null })).rejects.toMatchObject({
      code: "VISIT_CHANGED",
      kind: "CONFLICT",
    });
  });
});

describe("updateVisit (D202, D205, D206)", () => {
  it("saves the notes through update_visit under the database's names, audited by name alone", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({
        data: {
          before: { notes: null, complaint: null, diagnosis: "Cold" },
          after: { notes: "Rest", complaint: "Fever", diagnosis: "Cold" },
        },
      }),
    });
    expect(
      await updateVisit(
        tenant,
        "v-1",
        {
          section: "NOTES",
          changes: { complaint: "Fever", diagnosis: "Cold", notes: "Rest" },
          seen: { complaint: null, diagnosis: "Cold", notes: null },
        },
        "req_n",
      ),
    ).toEqual({ complaint: "Fever", diagnosis: "Cold", notes: "Rest" });
    expect(rpcs).toEqual([
      {
        name: "update_visit",
        args: {
          p_visit_id: "v-1",
          p_changes: { complaint: "Fever", diagnosis: "Cold", notes: "Rest" },
          p_seen: { complaint: null, diagnosis: "Cold", notes: null },
        },
      },
    ]);
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "UPDATE",
        entityType: "visits",
        entityId: "v-1",
        changes: { fields: ["complaint", "notes"] },
        requestId: "req_n",
      },
    ]);
  });

  it("saves the follow-up, audited by its day from what to what, and none once removed", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({ data: { before: { follow_up_on: "2026-10-20" }, after: { follow_up_on: null } } }),
    });
    expect(
      await updateVisit(tenant, "v-1", {
        section: "FOLLOW_UP",
        changes: { followUpOn: null },
        seen: { followUpOn: "2026-10-20" },
      }),
    ).toEqual({ followUpOn: null });
    expect(rpcs[0].args).toEqual({
      p_visit_id: "v-1",
      p_changes: { follow_up_on: null },
      p_seen: { follow_up_on: "2026-10-20" },
    });
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "UPDATE",
        entityType: "visits",
        entityId: "v-1",
        changes: { follow_up_on: { from: "2026-10-20", to: null } },
        requestId: undefined,
      },
    ]);
  });

  it("audits nothing when nothing changed, and says why it was refused", async () => {
    const same = tenantWith({
      rpc: () => ({ data: { before: { follow_up_on: "2026-10-20" }, after: { follow_up_on: "2026-10-20" } } }),
    });
    expect(
      await updateVisit(same.tenant, "v-1", {
        section: "FOLLOW_UP",
        changes: { followUpOn: "2026-10-20" },
        seen: { followUpOn: "2026-10-20" },
      }),
    ).toEqual({ followUpOn: "2026-10-20" });
    expect(logActionsSafe).not.toHaveBeenCalled();

    const { tenant } = tenantWith({ rpc: () => refused("VISIT_CHANGED") });
    await expect(
      updateVisit(tenant, "v-1", { section: "FOLLOW_UP", changes: { followUpOn: null }, seen: { followUpOn: null } }),
    ).rejects.toMatchObject({ code: "VISIT_CHANGED" });
  });
});

describe("startVisit (D204)", () => {
  it("starts one through start_visit, audited as opened", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: { visit_id: "v-3", created: true } }) });
    expect(await startVisit(tenant, { patientId: "p-1", doctorId: "d-1" }, "req_s")).toEqual({
      visitId: "v-3",
      created: true,
    });
    expect(rpcs).toEqual([{ name: "start_visit", args: { p_patient_id: "p-1", p_doctor_id: "d-1" } }]);
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "CREATE",
        entityType: "visits",
        entityId: "v-3",
        changes: { status: { from: null, to: "OPEN" } },
        requestId: "req_s",
      },
    ]);
  });

  it("finds the one already open without auditing it, and says why it was refused", async () => {
    const found = tenantWith({ rpc: () => ({ data: { visit_id: "v-3", created: false } }) });
    expect(await startVisit(found.tenant, { patientId: "p-1", doctorId: "d-1" })).toEqual({
      visitId: "v-3",
      created: false,
    });
    expect(logActionsSafe).not.toHaveBeenCalled();

    const { tenant } = tenantWith({ rpc: () => refused("PATIENT_ARCHIVED") });
    await expect(startVisit(tenant, { patientId: "p-1", doctorId: "d-1" })).rejects.toMatchObject({
      code: "PATIENT_ARCHIVED",
    });
  });
});

describe("finishVisit (D204)", () => {
  it("closes an open one through finish_visit, audited with the billing state it closed with", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: { previously: "OPEN", billing: "TO_BILL" } }) });
    expect(await finishVisit(tenant, "v-3", "req_f")).toEqual({ visitId: "v-3" });
    expect(rpcs).toEqual([{ name: "finish_visit", args: { p_visit_id: "v-3" } }]);
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "STATUS_CHANGE",
        entityType: "visits",
        entityId: "v-3",
        changes: { status: { from: "OPEN", to: "COMPLETED" }, billing_status: { from: null, to: "TO_BILL" } },
        requestId: "req_f",
      },
    ]);
  });

  it("audits nothing once already done, and says why it was refused", async () => {
    const done = tenantWith({ rpc: () => ({ data: { previously: "COMPLETED" } }) });
    expect(await finishVisit(done.tenant, "v-3")).toEqual({ visitId: "v-3" });
    expect(logActionsSafe).not.toHaveBeenCalled();

    const { tenant } = tenantWith({ rpc: () => refused("APPOINTMENT_STATUS_NOT_ALLOWED") });
    await expect(finishVisit(tenant, "v-3")).rejects.toMatchObject({ code: "APPOINTMENT_STATUS_NOT_ALLOWED" });
  });
});
