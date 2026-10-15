// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionSafe, logActionsSafe } = vi.hoisted(() => ({ logActionSafe: vi.fn(), logActionsSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe, logActionsSafe }));

const { changeTreatmentStatus, createTreatment, recordFollowUpContact, recordSession, removeSession, updateTreatment } =
  await import("@/features/treatments/records");

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant = { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1" } as Tenant;
  return { ...fake, tenant };
}

const refused = (hint: string) => ({ error: { ...postgrestError("P0001"), hint } });
const NEW = {
  patientId: "p-1",
  visitId: "v-1",
  doctorId: null,
  start: "IN_PROGRESS" as const,
  name: "Root canal",
  description: null,
  estimatedCost: 450000,
  note: "Access opened",
  nextDueOn: null,
};

beforeEach(() => vi.clearAllMocks());

describe("createTreatment (D252, D258)", () => {
  it("makes it through create_treatment, audited as made, its first session with it", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: { treatment_id: "t-1", session_id: "s-1" } }) });
    expect(await createTreatment(tenant, NEW, "req_t")).toEqual({ id: "t-1", name: "Root canal" });
    expect(rpcs).toEqual([
      {
        name: "create_treatment",
        args: {
          p_treatment: {
            name: "Root canal",
            description: null,
            status: "IN_PROGRESS",
            estimated_cost_paise: 450000,
            next_due_on: null,
            patient_id: "p-1",
            doctor_id: null,
            note: "Access opened",
          },
          p_visit_id: "v-1",
        },
      },
    ]);
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "CREATE",
        entityType: "treatments",
        entityId: "t-1",
        changes: {
          status: { from: null, to: "IN_PROGRESS" },
          estimated_cost_paise: { from: null, to: 450000 },
          next_due_on: { from: null, to: null },
          fields: ["name"],
        },
        requestId: "req_t",
      },
      {
        action: "CREATE",
        entityType: "treatment_sessions",
        entityId: "s-1",
        changes: { fields: ["note"] },
        requestId: "req_t",
      },
    ]);
  });

  it("audits no session when none was recorded, and passes a refusal on", async () => {
    const { tenant } = tenantWith({ rpc: () => ({ data: { treatment_id: "t-2", session_id: null } }) });
    await createTreatment(tenant, { ...NEW, visitId: null, doctorId: "d-1", start: "PLANNED", note: null });
    expect(logActionsSafe.mock.calls[0][1]).toHaveLength(1);
    const { tenant: refusing } = tenantWith({ rpc: () => refused("PATIENT_ARCHIVED") });
    await expect(createTreatment(refusing, NEW)).rejects.toMatchObject({ code: "PATIENT_ARCHIVED" });
  });
});

describe("updateTreatment (D251, D252, D259)", () => {
  it("saves its details from the copy read, audited by value, the clinical by name alone", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({
        data: {
          before: { name: "Root canal", description: null, estimated_cost_paise: null, doctor_id: "d-1" },
          after: { name: "Root canal (UL6)", description: null, estimated_cost_paise: 450000, doctor_id: "d-2" },
        },
      }),
    });
    const saved = await updateTreatment(
      tenant,
      "t-1",
      {
        part: "DETAILS",
        changes: { name: "Root canal (UL6)", description: null, estimatedCost: 450000, doctorId: "d-2" },
        seen: { name: "Root canal", description: null, estimatedCostPaise: null, doctorId: "d-1" },
      },
      "req_u",
    );
    expect(saved).toEqual({ name: "Root canal (UL6)", description: null, estimatedCostPaise: 450000, doctorId: "d-2" });
    expect(rpcs[0].args).toEqual({
      p_treatment_id: "t-1",
      p_changes: { name: "Root canal (UL6)", description: null, estimated_cost_paise: 450000, doctor_id: "d-2" },
      p_seen: { name: "Root canal", description: null, estimated_cost_paise: null, doctor_id: "d-1" },
    });
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "UPDATE",
        entityType: "treatments",
        entityId: "t-1",
        changes: {
          estimated_cost_paise: { from: null, to: 450000 },
          doctor_id: { from: "d-1", to: "d-2" },
          fields: ["name"],
        },
        requestId: "req_u",
      },
    ]);
  });

  it("saves its next sitting, audits nothing when nothing changed, and passes a refusal on", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({ data: { before: { next_due_on: "2026-10-22" }, after: { next_due_on: "2026-10-22" } } }),
    });
    const change = {
      part: "NEXT_DUE" as const,
      changes: { nextDueOn: "2026-10-22" },
      seen: { nextDueOn: "2026-10-22" },
    };
    expect(await updateTreatment(tenant, "t-1", change)).toEqual({ nextDueOn: "2026-10-22" });
    expect(rpcs[0].args).toMatchObject({ p_changes: { next_due_on: "2026-10-22" } });
    expect(logActionsSafe).not.toHaveBeenCalled();
    const { tenant: refusing } = tenantWith({ rpc: () => refused("TREATMENT_CHANGED") });
    await expect(updateTreatment(refusing, "t-1", change)).rejects.toMatchObject({ code: "TREATMENT_CHANGED" });
  });
});

describe("changeTreatmentStatus (D250, D251)", () => {
  it("moves it from the status read, audited from what to what, a reason by name alone", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: { before: "PLANNED", after: "CANCELLED" } }) });
    expect(
      await changeTreatmentStatus(tenant, "t-1", { status: "CANCELLED", seen: "PLANNED", reason: "Declined" }, "req_s"),
    ).toEqual({ status: "CANCELLED" });
    expect(rpcs[0]).toEqual({
      name: "change_treatment_status",
      args: { p_treatment_id: "t-1", p_status: "CANCELLED", p_seen: "PLANNED", p_reason: "Declined" },
    });
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "STATUS_CHANGE",
        entityType: "treatments",
        entityId: "t-1",
        changes: { status: { from: "PLANNED", to: "CANCELLED" }, fields: ["cancel_reason"] },
        requestId: "req_s",
      },
    ]);
  });

  it("audits a move without a reason as it is, a double tap not at all, and passes a refusal on", async () => {
    const { tenant } = tenantWith({ rpc: () => ({ data: { before: "PLANNED", after: "ON_HOLD" } }) });
    await changeTreatmentStatus(tenant, "t-1", { status: "ON_HOLD", seen: "PLANNED", reason: null });
    expect(logActionsSafe.mock.calls[0][1][0].changes).toEqual({ status: { from: "PLANNED", to: "ON_HOLD" } });
    logActionsSafe.mockClear();
    const { tenant: twice } = tenantWith({ rpc: () => ({ data: { before: "ON_HOLD", after: "ON_HOLD" } }) });
    await changeTreatmentStatus(twice, "t-1", { status: "ON_HOLD", seen: "PLANNED", reason: null });
    expect(logActionsSafe).not.toHaveBeenCalled();
    const { tenant: refusing } = tenantWith({ rpc: () => refused("TREATMENT_STATUS_NOT_ALLOWED") });
    await expect(
      changeTreatmentStatus(refusing, "t-1", { status: "COMPLETED", seen: "PLANNED", reason: null }),
    ).rejects.toMatchObject({ code: "TREATMENT_STATUS_NOT_ALLOWED" });
  });
});

describe("recordSession (D248, D256, D257)", () => {
  const answer = (data: Record<string, unknown>) =>
    tenantWith({
      rpc: () => ({
        data: {
          session_id: "s-1",
          created: true,
          before: null,
          after: { note: "Canal filled" },
          status_before: "IN_PROGRESS",
          status_after: "IN_PROGRESS",
          ...data,
        },
      }),
    });

  it("records the first on a planned one, which it starts, and completes it in the same save", async () => {
    const { tenant, rpcs } = answer({ status_before: "PLANNED", status_after: "COMPLETED" });
    expect(
      await recordSession(tenant, "t-1", "v-1", { note: "Canal filled", complete: true, seen: null }, "req_r"),
    ).toEqual({ note: "Canal filled", status: "COMPLETED" });
    expect(rpcs[0]).toEqual({
      name: "record_treatment_session",
      args: { p_treatment_id: "t-1", p_visit_id: "v-1", p_note: "Canal filled", p_seen: null, p_complete: true },
    });
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "CREATE",
        entityType: "treatment_sessions",
        entityId: "s-1",
        changes: { fields: ["note"] },
        requestId: "req_r",
      },
      {
        action: "STATUS_CHANGE",
        entityType: "treatments",
        entityId: "t-1",
        changes: { status: { from: "PLANNED", to: "IN_PROGRESS" } },
        requestId: "req_r",
      },
      {
        action: "STATUS_CHANGE",
        entityType: "treatments",
        entityId: "t-1",
        changes: { status: { from: "IN_PROGRESS", to: "COMPLETED" } },
        requestId: "req_r",
      },
    ]);
  });

  it("changes a note from the copy read, completing one in progress, and audits only what changed", async () => {
    const { tenant } = answer({ created: false, before: { note: "Opened" }, status_after: "COMPLETED" });
    await recordSession(tenant, "t-1", "v-1", { note: "Canal filled", complete: true, seen: { note: "Opened" } });
    expect(logActionsSafe.mock.calls[0][1].map((entry: { action: string }) => entry.action)).toEqual([
      "UPDATE",
      "STATUS_CHANGE",
    ]);
    logActionsSafe.mockClear();
    const { tenant: same } = answer({ created: false, before: { note: "Canal filled" } });
    await recordSession(same, "t-1", "v-1", { note: "Canal filled", complete: false, seen: { note: "Canal filled" } });
    expect(logActionsSafe).toHaveBeenCalledWith(same, []);
    logActionsSafe.mockClear();
    const { tenant: resumed } = answer({ status_before: "ON_HOLD" });
    await recordSession(resumed, "t-1", "v-1", { note: "Canal filled", complete: false, seen: null });
    expect(logActionsSafe.mock.calls[0][1][1].changes).toEqual({ status: { from: "ON_HOLD", to: "IN_PROGRESS" } });
  });

  it("passes a refusal on", async () => {
    const { tenant } = tenantWith({ rpc: () => refused("VISIT_CHANGED") });
    await expect(
      recordSession(tenant, "t-1", "v-1", { note: null, complete: false, seen: null }),
    ).rejects.toMatchObject({ code: "VISIT_CHANGED" });
  });
});

describe("removeSession (D254)", () => {
  it("removes it by its treatment and visit, audited as removed, and passes a refusal on", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: { session_id: "s-1" } }) });
    expect(await removeSession(tenant, "t-1", "v-1", "req_x")).toEqual({ treatmentId: "t-1", visitId: "v-1" });
    expect(rpcs[0]).toEqual({ name: "remove_treatment_session", args: { p_treatment_id: "t-1", p_visit_id: "v-1" } });
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      { action: "DELETE", entityType: "treatment_sessions", entityId: "s-1", requestId: "req_x" },
    ]);
    const { tenant: refusing } = tenantWith({ rpc: () => refused("TREATMENT_SESSION_KEPT") });
    await expect(removeSession(refusing, "t-1", "v-1")).rejects.toMatchObject({ code: "TREATMENT_SESSION_KEPT" });
  });
});

describe("recordFollowUpContact (plan §14.3; D271, D273)", () => {
  const noted = { contact_id: "c-1", patient_id: "p-1", outcome: "NO_ANSWER", snooze_until: "2026-10-18" };

  it("notes a treatment's through record_follow_up_contact, audited with the note by name alone", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: noted }) });
    const contact = {
      kind: "TREATMENT" as const,
      id: "t-1",
      outcome: "NO_ANSWER" as const,
      note: "Line busy",
      snoozeUntil: "2026-10-18",
    };
    expect(await recordFollowUpContact(tenant, contact, "req_c")).toEqual({
      id: "c-1",
      patientId: "p-1",
      outcome: "NO_ANSWER",
      snoozeUntil: "2026-10-18",
    });
    expect(rpcs).toEqual([
      {
        name: "record_follow_up_contact",
        args: {
          p_contact: { outcome: "NO_ANSWER", note: "Line busy", snooze_until: "2026-10-18", treatment_id: "t-1" },
        },
      },
    ]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "CREATE",
      entityType: "follow_up_contacts",
      entityId: "c-1",
      changes: {
        outcome: { from: null, to: "NO_ANSWER" },
        snooze_until: { from: null, to: "2026-10-18" },
        fields: ["note"],
      },
      requestId: "req_c",
    });
  });

  it("notes a visit's by its visit — a reminder sent, with nothing more", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({ data: { ...noted, outcome: "REMINDER_SENT", snooze_until: null } }),
    });
    await recordFollowUpContact(tenant, {
      kind: "VISIT",
      id: "v-1",
      outcome: "REMINDER_SENT",
      note: null,
      snoozeUntil: null,
    });
    expect(rpcs[0].args).toEqual({
      p_contact: { outcome: "REMINDER_SENT", note: null, snooze_until: null, visit_id: "v-1" },
    });
    expect(logActionSafe.mock.calls[0][1].changes).toEqual({
      outcome: { from: null, to: "REMINDER_SENT" },
      snooze_until: { from: null, to: null },
    });
  });

  it("passes a refusal on", async () => {
    const { tenant } = tenantWith({ rpc: () => refused("PATIENT_ARCHIVED") });
    await expect(
      recordFollowUpContact(tenant, { kind: "VISIT", id: "v-1", outcome: "REACHED", note: null, snoozeUntil: null }),
    ).rejects.toMatchObject({ code: "PATIENT_ARCHIVED" });
    expect(logActionSafe).not.toHaveBeenCalled();
  });
});
