// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionSafe } = vi.hoisted(() => ({ logActionSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe }));

const { countToBill, listToBill, markNoCharge } = await import("@/features/billing/checkout");

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant = { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1" } as Tenant;
  return { ...fake, tenant };
}

const refused = (hint: string) => ({ error: { ...postgrestError("P0001"), hint } });

const row = {
  visit_id: "v-1",
  visit_date: "2026-10-18",
  completed_at: "2026-10-18T06:00:00Z",
  patient_id: "p-1",
  patient_name: "Asha Rao",
  patient_number: 1042,
  patient_archived: false,
  doctor_id: "d-1",
  doctor_name: "Maya Rao",
  appointment_id: "a-1",
  token_number: 7,
  treatments: ["Root canal"],
  fee_paid: true,
};

beforeEach(() => vi.clearAllMocks());

describe("listToBill (plan §15.6; D318)", () => {
  it("reads a page of one doctor's visits to bill through to_bill_visits, one more than a page", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: [row, { ...row, visit_id: "v-2", doctor_id: null }] }) });
    expect(await listToBill(tenant, { doctorId: "d-1", cursor: 20 })).toEqual({
      items: [
        {
          visitId: "v-1",
          day: "2026-10-18",
          completedAt: "2026-10-18T06:00:00Z",
          patient: { id: "p-1", name: "Asha Rao", number: 1042, archived: false },
          doctor: { id: "d-1", name: "Maya Rao" },
          appointmentId: "a-1",
          token: 7,
          treatments: ["Root canal"],
          feePaid: true,
        },
        expect.objectContaining({ visitId: "v-2", doctor: null }),
      ],
      nextCursor: null,
    });
    expect(rpcs).toEqual([{ name: "to_bill_visits", args: { p_doctor_id: "d-1", p_offset: 20, p_limit: 21 } }]);
  });

  it("reads every doctor's from the first page, nothing found as none, and says what it was refused", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: null }) });
    expect(await listToBill(tenant, {})).toEqual({ items: [], nextCursor: null });
    expect(rpcs[0].args).toEqual({ p_doctor_id: null, p_offset: 0, p_limit: 21 });
    const denied = tenantWith({ rpc: () => refused("AUTH_PERMISSION_DENIED") });
    await expect(listToBill(denied.tenant, {})).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("countToBill (D337)", () => {
  it("counts one doctor's, or every doctor's, through to_bill_count", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: 3 }) });
    expect(await countToBill(tenant, { doctorId: "d-1" })).toEqual({ count: 3 });
    await countToBill(tenant, {});
    expect(rpcs).toEqual([
      { name: "to_bill_count", args: { p_doctor_id: "d-1" } },
      { name: "to_bill_count", args: { p_doctor_id: null } },
    ]);
    const denied = tenantWith({ rpc: () => refused("AUTH_PERMISSION_DENIED") });
    await expect(countToBill(denied.tenant, {})).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("markNoCharge (plan §15.6; D319)", () => {
  it("settles the visit free through mark_no_charge, and audits the move and its reason", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: { previously: "TO_BILL" } }) });
    expect(await markNoCharge(tenant, "v-1", { reason: "REVIEW", note: null }, "req_n")).toEqual({ visitId: "v-1" });
    expect(rpcs).toEqual([{ name: "mark_no_charge", args: { p_visit_id: "v-1", p_reason: "REVIEW", p_note: null } }]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "UPDATE",
      entityType: "visits",
      entityId: "v-1",
      changes: {
        billing_status: { from: "TO_BILL", to: "NO_CHARGE" },
        no_charge_reason: { from: null, to: "REVIEW" },
      },
      requestId: "req_n",
    });
  });

  it("audits nothing for one marked already, and says what it was refused", async () => {
    const again = tenantWith({ rpc: () => ({ data: { previously: "NO_CHARGE" } }) });
    await markNoCharge(again.tenant, "v-1", { reason: "COURTESY", note: null });
    expect(logActionSafe).not.toHaveBeenCalled();
    const billed = tenantWith({ rpc: () => refused("VISIT_NOT_TO_BILL") });
    await expect(markNoCharge(billed.tenant, "v-1", { reason: "REVIEW", note: null })).rejects.toMatchObject({
      code: "VISIT_NOT_TO_BILL",
    });
  });
});
