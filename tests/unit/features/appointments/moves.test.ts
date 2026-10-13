// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionsSafe } = vi.hoisted(() => ({ logActionsSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionsSafe }));

const { backToWaiting, markDone, markSteppedOut, markUrgent, movesAudited, nextPatient, sendIn } =
  await import("@/features/appointments/moves");

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant = { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1" } as Tenant;
  return { ...fake, tenant };
}

const sentIn = { entity: "APPOINTMENT", id: "a-1", from: "ARRIVED", to: "IN_PROGRESS" } as const;
const opened = { entity: "VISIT", id: "v-1", from: null, to: "OPEN" } as const;

beforeEach(() => vi.clearAllMocks());

describe("movesAudited (plan §27.6)", () => {
  it("audits each appointment's status, and each visit opened, closed as To bill, or removed", () => {
    expect(
      movesAudited(
        [
          sentIn,
          opened,
          { entity: "VISIT", id: "v-2", from: "OPEN", to: "COMPLETED" },
          { entity: "VISIT", id: "v-3", from: "OPEN", to: null },
        ],
        "req_1",
      ),
    ).toEqual([
      {
        action: "STATUS_CHANGE",
        entityType: "appointments",
        entityId: "a-1",
        changes: { status: { from: "ARRIVED", to: "IN_PROGRESS" } },
        requestId: "req_1",
      },
      {
        action: "CREATE",
        entityType: "visits",
        entityId: "v-1",
        changes: { status: { from: null, to: "OPEN" } },
        requestId: "req_1",
      },
      {
        action: "STATUS_CHANGE",
        entityType: "visits",
        entityId: "v-2",
        changes: { status: { from: "OPEN", to: "COMPLETED" }, billing_status: { from: null, to: "TO_BILL" } },
        requestId: "req_1",
      },
      {
        action: "DELETE",
        entityType: "visits",
        entityId: "v-3",
        changes: { status: { from: "OPEN", to: null } },
        requestId: "req_1",
      },
    ]);
  });
});

describe("sendIn (D192)", () => {
  it("sends in through send_in with what becomes of those in, audits what moved, answers the visit", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: { moves: [sentIn, opened], visit_id: "v-1" } }) });
    expect(await sendIn(tenant, { appointmentId: "a-1", others: "KEEP" }, "req_in")).toEqual({ visitId: "v-1" });
    expect(rpcs).toEqual([{ name: "send_in", args: { p_appointment_id: "a-1", p_others: "KEEP" } }]);
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, movesAudited([sentIn, opened], "req_in"));

    await sendIn(tenant, { appointmentId: "a-1" });
    expect(rpcs[1].args).toEqual({ p_appointment_id: "a-1", p_others: null });
  });

  it("says why it was refused, auditing nothing", async () => {
    const { tenant } = tenantWith({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "DOCTOR_ROOM_TAKEN" } }),
    });
    await expect(sendIn(tenant, { appointmentId: "a-1" })).rejects.toMatchObject({
      code: "DOCTOR_ROOM_TAKEN",
      kind: "CONFLICT",
    });
    expect(logActionsSafe).not.toHaveBeenCalled();
  });
});

describe("markDone and backToWaiting (D43, D197)", () => {
  it("move through mark_done and back_to_waiting, audited, answering the appointment", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: { moves: [] } }) });
    expect(await markDone(tenant, { appointmentId: "a-1" }, "req_d")).toEqual({ appointmentId: "a-1" });
    expect(await backToWaiting(tenant, { appointmentId: "a-1" })).toEqual({ appointmentId: "a-1" });
    expect(rpcs).toEqual([
      { name: "mark_done", args: { p_appointment_id: "a-1" } },
      { name: "back_to_waiting", args: { p_appointment_id: "a-1" } },
    ]);
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, []);
  });
});

describe("nextPatient (D196)", () => {
  it("answers who went in, in the screens' words", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({
        data: {
          moves: [sentIn],
          sent: { appointment_id: "a-2", visit_id: "v-2", token: 8, patient_name: "Asha Iyer" },
        },
      }),
    });
    expect(await nextPatient(tenant, { doctorId: "d-1", appointmentId: "a-1" })).toEqual({
      sent: { appointmentId: "a-2", visitId: "v-2", token: 8, patientName: "Asha Iyer" },
    });
    expect(rpcs).toEqual([{ name: "next_patient", args: { p_doctor_id: "d-1", p_appointment_id: "a-1" } }]);
  });

  it("answers no one when no one is waiting, and asks with no one named while the room is free", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: { moves: [], sent: null } }) });
    expect(await nextPatient(tenant, { doctorId: "d-1" })).toEqual({ sent: null });
    expect(rpcs[0].args).toEqual({ p_doctor_id: "d-1", p_appointment_id: null });
  });
});

describe("markSteppedOut (D198)", () => {
  it("marks it through mark_stepped_out, audited from when to when", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({ data: { stepped_out_at: "2026-10-13T05:00:00Z", previously: null } }),
    });
    expect(await markSteppedOut(tenant, { appointmentId: "a-1", out: true }, "req_s")).toEqual({
      steppedOutAt: "2026-10-13T05:00:00Z",
    });
    expect(rpcs).toEqual([{ name: "mark_stepped_out", args: { p_appointment_id: "a-1", p_out: true } }]);
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "UPDATE",
        entityType: "appointments",
        entityId: "a-1",
        changes: { stepped_out_at: { from: null, to: "2026-10-13T05:00:00Z" } },
        requestId: "req_s",
      },
    ]);
  });

  it("audits nothing when nothing changed, and says why it was refused", async () => {
    const same = tenantWith({ rpc: () => ({ data: { stepped_out_at: null, previously: null } }) });
    expect(await markSteppedOut(same.tenant, { appointmentId: "a-1", out: false })).toEqual({ steppedOutAt: null });
    expect(logActionsSafe).not.toHaveBeenCalled();
    const { tenant } = tenantWith({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "APPOINTMENT_STATUS_NOT_ALLOWED" } }),
    });
    await expect(markSteppedOut(tenant, { appointmentId: "a-1", out: true })).rejects.toMatchObject({
      code: "APPOINTMENT_STATUS_NOT_ALLOWED",
    });
  });
});

describe("markUrgent (D201)", () => {
  it("marks it through mark_urgent, audited from when to when", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({ data: { urgent_at: "2026-10-13T05:00:00Z", previously: null } }),
    });
    expect(await markUrgent(tenant, { appointmentId: "a-1", urgent: true }, "req_u")).toEqual({
      urgentAt: "2026-10-13T05:00:00Z",
    });
    expect(rpcs).toEqual([{ name: "mark_urgent", args: { p_appointment_id: "a-1", p_urgent: true } }]);
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "UPDATE",
        entityType: "appointments",
        entityId: "a-1",
        changes: { urgent_at: { from: null, to: "2026-10-13T05:00:00Z" } },
        requestId: "req_u",
      },
    ]);
  });

  it("audits nothing when nothing changed, and says why it was refused", async () => {
    const same = tenantWith({ rpc: () => ({ data: { urgent_at: null, previously: null } }) });
    expect(await markUrgent(same.tenant, { appointmentId: "a-1", urgent: false })).toEqual({ urgentAt: null });
    expect(logActionsSafe).not.toHaveBeenCalled();
    const { tenant } = tenantWith({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "APPOINTMENT_STATUS_NOT_ALLOWED" } }),
    });
    await expect(markUrgent(tenant, { appointmentId: "a-1", urgent: true })).rejects.toMatchObject({
      code: "APPOINTMENT_STATUS_NOT_ALLOWED",
    });
  });
});
