// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import type { BillPayload } from "@/lib/validation";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionsSafe } = vi.hoisted(() => ({ logActionsSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionsSafe }));

const { getBillStart, issueBill } = await import("@/features/billing/api");

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant = { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1" } as Tenant;
  return { ...fake, tenant };
}

const refused = (hint: string) => ({ error: { ...postgrestError("P0001"), hint } });

const startRow = {
  patient: {
    id: "p-1",
    full_name: "Asha Rao",
    patient_number: 1042,
    date_of_birth: "1990-01-01",
    gender: "FEMALE",
    archived: false,
  },
  visit: { id: "v-1", visit_date: "2026-10-16", status: "COMPLETED", billing_status: "TO_BILL" },
  appointment: null,
  doctor: { id: "d-1", full_name: "Maya Rao", fee_paise: 80_000 },
  consultation_billed: false,
  treatments: [{ id: "t-1", name: "Root canal" }],
  balance_paise: 20_000,
  to_bill: null,
};

beforeEach(() => vi.clearAllMocks());

describe("getBillStart (plan §15.2; D285, D313)", () => {
  it("reads where a visit's bill starts through bill_start, in the screen's own shape", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: startRow }) });
    expect(await getBillStart(tenant, { visit: "v-1" })).toEqual({
      patient: {
        id: "p-1",
        name: "Asha Rao",
        number: 1042,
        dateOfBirth: "1990-01-01",
        gender: "FEMALE",
        archived: false,
      },
      visit: { id: "v-1", day: "2026-10-16", status: "COMPLETED", billingStatus: "TO_BILL" },
      appointment: null,
      doctor: { id: "d-1", name: "Maya Rao", feePaise: 80_000 },
      consultationBilled: false,
      treatments: [{ id: "t-1", name: "Root canal" }],
      balancePaise: 20_000,
      toBill: null,
    });
    expect(rpcs).toEqual([
      { name: "bill_start", args: { p_visit_id: "v-1", p_appointment_id: null, p_patient_id: null } },
    ]);
  });

  it("reads an arrival's token, and a patient's oldest visit to bill, without a doctor", async () => {
    const arrival = tenantWith({
      rpc: () => ({
        data: { ...startRow, visit: null, appointment: { id: "a-1", status: "ARRIVED", token_number: 7 } },
      }),
    });
    expect(await getBillStart(arrival.tenant, { appointment: "a-1" })).toMatchObject({
      visit: null,
      appointment: { id: "a-1", status: "ARRIVED", token: 7 },
    });
    expect(arrival.rpcs[0].args).toEqual({ p_visit_id: null, p_appointment_id: "a-1", p_patient_id: null });

    const patient = tenantWith({
      rpc: () => ({
        data: {
          ...startRow,
          visit: null,
          doctor: null,
          treatments: [],
          to_bill: { visit_id: "v-9", visit_date: "2026-10-12" },
        },
      }),
    });
    expect(await getBillStart(patient.tenant, { patient: "p-1" })).toMatchObject({
      doctor: null,
      toBill: { visitId: "v-9", day: "2026-10-12" },
    });
    expect(patient.rpcs[0].args).toEqual({ p_visit_id: null, p_appointment_id: null, p_patient_id: "p-1" });
  });

  it("says, in its own words, what it was refused", async () => {
    const { tenant } = tenantWith({ rpc: () => refused("RECORD_NOT_FOUND") });
    await expect(getBillStart(tenant, { visit: "v-1" })).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
  });
});

const bill: BillPayload = {
  patientId: "p-1",
  visitId: "v-1",
  appointmentId: null,
  items: [
    { serviceId: "s-1", treatmentId: null, description: null, quantity: 1, unitPricePaise: 50_000 },
    { serviceId: null, treatmentId: null, description: "Dressing kit", quantity: 3, unitPricePaise: 4_000 },
  ],
  discount: { kind: "PERCENT", percent: 10 },
  notes: "Paid by her son",
  payment: { amountPaise: 50_000, method: "UPI", reference: "UTR 42" },
};

const issued = {
  bill_id: "b-1",
  bill_number: "2026-27/0042",
  total_paise: 55_800,
  payment_id: "pay-1",
  created: true,
  visit: { id: "v-1", from: "TO_BILL", to: "BILLED" },
  balance_paise: 25_800,
};

describe("issueBill (plan §15.2; D282, D302)", () => {
  it("sends the totals by the one formula with the lines, the discount and the payment, once per key", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: issued }) });
    expect(await issueBill(tenant, bill, "key-1", "req_b")).toEqual({
      billId: "b-1",
      billNumber: "2026-27/0042",
      totalPaise: 55_800,
      collectedPaise: 50_000,
      balancePaise: 25_800,
    });
    expect(rpcs).toEqual([
      {
        name: "create_bill",
        args: {
          p_bill: {
            patient_id: "p-1",
            visit_id: "v-1",
            appointment_id: null,
            subtotal_paise: 62_000,
            discount_paise: 6_200,
            total_paise: 55_800,
            notes: "Paid by her son",
            items: [
              { service_id: "s-1", treatment_id: null, description: null, quantity: 1, unit_price_paise: 50_000 },
              {
                service_id: null,
                treatment_id: null,
                description: "Dressing kit",
                quantity: 3,
                unit_price_paise: 4_000,
              },
            ],
            payment: { amount_paise: 50_000, method: "UPI", reference: "UTR 42" },
          },
          p_idempotency_key: "key-1",
        },
      },
    ]);
  });

  it("audits the bill's numbers, the payment and the visit turned Billed — none of it clinical", async () => {
    const { tenant } = tenantWith({ rpc: () => ({ data: issued }) });
    await issueBill(tenant, bill, "key-1", "req_b");
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "CREATE",
        entityType: "bills",
        entityId: "b-1",
        changes: {
          bill_number: { from: null, to: "2026-27/0042" },
          patient_id: { from: null, to: "p-1" },
          visit_id: { from: null, to: "v-1" },
          appointment_id: { from: null, to: null },
          subtotal_paise: { from: null, to: 62_000 },
          discount_paise: { from: null, to: 6_200 },
          total_paise: { from: null, to: 55_800 },
        },
        requestId: "req_b",
      },
      {
        action: "CREATE",
        entityType: "payments",
        entityId: "pay-1",
        changes: {
          kind: { from: null, to: "PAYMENT" },
          amount_paise: { from: null, to: 50_000 },
          method: { from: null, to: "UPI" },
        },
        requestId: "req_b",
      },
      {
        action: "UPDATE",
        entityType: "visits",
        entityId: "v-1",
        changes: { billing_status: { from: "TO_BILL", to: "BILLED" } },
        requestId: "req_b",
      },
    ]);
  });

  it("audits only the bill when nothing is collected and no visit moves, and nothing for a repeat", async () => {
    const plain = tenantWith({ rpc: () => ({ data: { ...issued, payment_id: null, visit: null } }) });
    expect(await issueBill(plain.tenant, { ...bill, discount: null, payment: null }, "key-2")).toMatchObject({
      collectedPaise: 0,
    });
    expect(plain.rpcs[0].args).toMatchObject({ p_bill: { discount_paise: 0, total_paise: 62_000, payment: null } });
    expect(logActionsSafe).toHaveBeenCalledWith(plain.tenant, [expect.objectContaining({ entityType: "bills" })]);

    logActionsSafe.mockClear();
    const again = tenantWith({ rpc: () => ({ data: { ...issued, created: false, visit: null } }) });
    expect(await issueBill(again.tenant, bill, "key-1")).toMatchObject({ billId: "b-1", collectedPaise: 50_000 });
    expect(logActionsSafe).not.toHaveBeenCalled();
  });

  it("says, in its own words, what it was refused", async () => {
    const { tenant } = tenantWith({ rpc: () => refused("BILL_PRICE_NOT_ALLOWED") });
    await expect(issueBill(tenant, bill, "key-1")).rejects.toMatchObject({ code: "BILL_PRICE_NOT_ALLOWED" });
    expect(logActionsSafe).not.toHaveBeenCalled();
  });
});
