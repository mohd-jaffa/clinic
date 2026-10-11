// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionSafe } = vi.hoisted(() => ({ logActionSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe }));

const { addClosure, listClosureAppointments, listClosures, removeClosure } = await import("@/features/clinic/closures");

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant: Tenant = {
    supabase: fake.client,
    clinicId: "clinic-1",
    actorId: "user-1",
    memberId: "member-1",
    role: "OWNER",
    permissions: [],
    doctorId: null,
  };
  return { ...fake, tenant };
}

const diwali = {
  id: "c-1",
  doctor_id: null,
  starts_on: "2026-10-20",
  ends_on: "2026-10-22",
  reason: "Diwali",
  doctor: null,
};
const leave = {
  id: "c-2",
  doctor_id: "d-1",
  starts_on: "2026-11-02",
  ends_on: "2026-11-04",
  reason: "Conference",
  doctor: { member: { profile: { full_name: "Rahul Nair" } } },
};

beforeEach(() => logActionSafe.mockReset());

describe("listClosures", () => {
  it("reads the clinic's closures by their first day, each doctor's leave with their name", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: [diwali, leave] }) });
    expect(await listClosures(tenant)).toEqual([
      { id: "c-1", doctorId: null, doctorName: null, startsOn: "2026-10-20", endsOn: "2026-10-22", reason: "Diwali" },
      {
        id: "c-2",
        doctorId: "d-1",
        doctorName: "Rahul Nair",
        startsOn: "2026-11-02",
        endsOn: "2026-11-04",
        reason: "Conference",
      },
    ]);
    expect(queries[0].table).toBe("clinic_closures");
    expect(argsOf(queries[0], "eq")).toEqual([["clinic_id", "clinic-1"]]);
    expect(argsOf(queries[0], "order")).toEqual([
      ["starts_on", { ascending: true }],
      ["ends_on", { ascending: true }],
    ]);
  });

  it("reads a doctor whose name it cannot see as no name", async () => {
    const { tenant } = tenantWith({ answer: () => ({ data: [{ ...leave, doctor: { member: null } }] }) });
    expect((await listClosures(tenant))[0].doctorName).toBeNull();
  });
});

describe("addClosure (D85, D86)", () => {
  it("writes it to the clinic, and audits it with its values", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: leave }) });
    const payload = { doctorId: "d-1", startsOn: "2026-11-02", endsOn: "2026-11-04", reason: "Conference" };
    expect(await addClosure(tenant, payload, "req_1")).toMatchObject({ id: "c-2", doctorName: "Rahul Nair" });
    expect(argsOf(queries[0], "insert")).toEqual([
      [
        {
          doctor_id: "d-1",
          starts_on: "2026-11-02",
          ends_on: "2026-11-04",
          reason: "Conference",
          clinic_id: "clinic-1",
        },
      ],
    ]);
    expect(logActionSafe).toHaveBeenCalledWith(
      tenant,
      expect.objectContaining({ action: "CREATE", entityType: "clinic_closures", entityId: "c-2", requestId: "req_1" }),
    );
  });

  it("says days the same people already have off, in its own words", async () => {
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("23P01") }) });
    await expect(
      addClosure(tenant, { doctorId: null, startsOn: "2026-10-21", endsOn: "2026-10-21", reason: "Puja" }),
    ).rejects.toMatchObject({ code: "CLOSURE_DAYS_TAKEN", kind: "CONFLICT" });
  });
});

describe("removeClosure (D84)", () => {
  it("removes it through remove_closure, audits what it was, and hands it back", async () => {
    const { tenant, rpcs, rpcChains } = tenantWith({ rpc: () => ({ data: diwali }) });
    expect(await removeClosure(tenant, "c-1", "req_2")).toMatchObject({ id: "c-1", reason: "Diwali" });
    expect(rpcs).toEqual([{ name: "remove_closure", args: { p_closure_id: "c-1" } }]);
    expect(rpcChains[0][0][0]).toBe("select");
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "DELETE",
      entityType: "clinic_closures",
      entityId: "c-1",
      changes: {
        doctor_id: { from: null, to: null },
        starts_on: { from: "2026-10-20", to: null },
        ends_on: { from: "2026-10-22", to: null },
        reason: { from: "Diwali", to: null },
      },
      requestId: "req_2",
    });
  });

  it("says why it could not, and that there was none", async () => {
    const over = tenantWith({ rpc: () => ({ error: { ...postgrestError("P0001"), hint: "CLOSURE_OVER" } }) });
    await expect(removeClosure(over.tenant, "c-1")).rejects.toMatchObject({ code: "CLOSURE_OVER" });
    const none = tenantWith({ rpc: () => ({ data: null }) });
    await expect(removeClosure(none.tenant, "c-1")).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    expect(logActionSafe).not.toHaveBeenCalled();
  });
});

describe("listClosureAppointments (D137)", () => {
  const days = { doctorId: "d-1", startsOn: "2026-10-20", endsOn: "2026-10-22" };

  it("asks closure_appointments for the first CLOSURE_APPOINTMENTS_SHOWN, and says how many in all", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({
        data: [
          {
            appointment_id: "a-1",
            scheduled_at: "2026-10-20T05:00:00+00:00",
            doctor_name: "Rahul Nair",
            patient_name: "Rohan Mehta",
            total: 3,
          },
          {
            appointment_id: "a-2",
            scheduled_at: "2026-10-21T04:30:00+00:00",
            doctor_name: "Rahul Nair",
            patient_name: null,
            total: 3,
          },
        ],
      }),
    });
    expect(await listClosureAppointments(tenant, days)).toEqual({
      total: 3,
      appointments: [
        { id: "a-1", scheduledAt: "2026-10-20T05:00:00+00:00", doctorName: "Rahul Nair", patientName: "Rohan Mehta" },
        { id: "a-2", scheduledAt: "2026-10-21T04:30:00+00:00", doctorName: "Rahul Nair", patientName: null },
      ],
    });
    expect(rpcs).toEqual([
      {
        name: "closure_appointments",
        args: { p_doctor_id: "d-1", p_starts_on: "2026-10-20", p_ends_on: "2026-10-22", p_limit: 20 },
      },
    ]);
  });

  it("finds none as none, and says why it could not ask", async () => {
    const none = tenantWith({ rpc: () => ({ data: [] }) });
    expect(await listClosureAppointments(none.tenant, days)).toEqual({ total: 0, appointments: [] });
    const refused = tenantWith({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "AUTH_PERMISSION_DENIED" } }),
    });
    await expect(listClosureAppointments(refused.tenant, days)).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});
