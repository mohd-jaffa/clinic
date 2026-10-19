// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import type { BillPayload } from "@/lib/validation";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionsSafe } = vi.hoisted(() => ({ logActionsSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionsSafe }));

const { getBill, getBillStart, issueBill, voidBill } = await import("@/features/billing/api");

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

const billRow = {
  id: "b-1",
  bill_number: "2026-27/0042",
  issued_at: "2026-10-16T05:30:00Z",
  issued_on: "2026-10-16",
  status: "ISSUED",
  visit_id: "v-1",
  appointment_id: null,
  subtotal_paise: 62_000,
  discount_paise: 6_200,
  total_paise: 55_800,
  notes: "Paid by her son",
  void_reason: null,
  voided_at: null,
  patient: {
    id: "p-1",
    full_name: "Asha Rao",
    patient_number: 1042,
    phone: "+919876543210",
    date_of_birth: "1990-01-01",
    gender: "FEMALE",
    archived_at: null,
    balance: { balance_paise: 25_800 },
  },
  doctor: { member: { profile: { full_name: "Maya Rao" } } },
  items: [
    {
      position: 2,
      description: "Dressing kit",
      quantity: 3,
      unit_price_paise: 4_000,
      amount_paise: 12_000,
      service_id: null,
      treatment_id: null,
    },
    {
      position: 1,
      description: "Consultation",
      quantity: 1,
      unit_price_paise: 50_000,
      amount_paise: 50_000,
      service_id: "s-1",
      treatment_id: null,
    },
  ],
  issuer: { full_name: "Priya Shah" },
  voider: null,
};
const settlementRow = { paid_paise: 30_000, due_paise: 25_800, state: "PART_PAID" };

/** Answers the bill and its settlement, each by its table. */
const billTenant = (
  bill: object | null,
  settlement: object | null = settlementRow,
  errors: Record<string, unknown> = {},
) =>
  tenantWith({
    answer: ({ table }) => (errors[table] ? { error: errors[table] } : { data: table === "bills" ? bill : settlement }),
  });

describe("getBill (plan §15.2; D314)", () => {
  it("reads the bill with its patient, balance, doctor, lines in order and people, beside where it stands", async () => {
    const { tenant, find } = billTenant(billRow);
    expect(await getBill(tenant, "b-1")).toEqual({
      id: "b-1",
      number: "2026-27/0042",
      issuedAt: "2026-10-16T05:30:00Z",
      issuedOn: "2026-10-16",
      status: "ISSUED",
      patient: {
        id: "p-1",
        name: "Asha Rao",
        number: 1042,
        phone: "+919876543210",
        dateOfBirth: "1990-01-01",
        gender: "FEMALE",
        archived: false,
      },
      visitId: "v-1",
      appointmentId: null,
      doctor: "Maya Rao",
      lines: [
        {
          description: "Consultation",
          quantity: 1,
          unitPricePaise: 50_000,
          amountPaise: 50_000,
          serviceId: "s-1",
          treatmentId: null,
        },
        {
          description: "Dressing kit",
          quantity: 3,
          unitPricePaise: 4_000,
          amountPaise: 12_000,
          serviceId: null,
          treatmentId: null,
        },
      ],
      subtotalPaise: 62_000,
      discountPaise: 6_200,
      totalPaise: 55_800,
      notes: "Paid by her son",
      issuedBy: "Priya Shah",
      void: null,
      settlement: { paidPaise: 30_000, duePaise: 25_800, state: "PART_PAID" },
      balancePaise: 25_800,
    });
    // The clinic's own, by its id; the settlement by the bill.
    expect(find("bills", "eq", "clinic_id", "clinic-1")).toBeDefined();
    expect(find("bills", "eq", "id", "b-1")).toBeDefined();
    expect(find("bill_settlement", "eq", "bill_id", "b-1")).toBeDefined();
  });

  it("reads a void bill — when, by whom, why — with no settlement, an archived patient, no doctor, no balance row", async () => {
    const { tenant } = billTenant(
      {
        ...billRow,
        status: "VOID",
        void_reason: "Wrong patient",
        voided_at: "2026-10-17T06:00:00Z",
        voider: { full_name: "Asha Menon" },
        doctor: null,
        issuer: null,
        patient: { ...billRow.patient, archived_at: "2026-10-17T07:00:00Z", balance: [] },
      },
      null,
    );
    expect(await getBill(tenant, "b-1")).toMatchObject({
      status: "VOID",
      void: { reason: "Wrong patient", at: "2026-10-17T06:00:00Z", by: "Asha Menon" },
      settlement: null,
      doctor: null,
      issuedBy: null,
      patient: { archived: true },
      balancePaise: 0,
    });
    const gone = billTenant(
      { ...billRow, status: "VOID", void_reason: "Wrong", voided_at: "2026-10-17T06:00:00Z", voider: null },
      null,
    );
    expect((await getBill(gone.tenant, "b-1")).void).toEqual({ reason: "Wrong", at: "2026-10-17T06:00:00Z", by: null });
  });

  it("refuses a bill it cannot find or read, and says what the database refused", async () => {
    await expect(getBill(billTenant(null).tenant, "b-1")).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    await expect(
      getBill(billTenant(billRow, null, { bills: postgrestError("XX000") }).tenant, "b-1"),
    ).rejects.toMatchObject({ kind: "INTERNAL" });
    await expect(
      getBill(billTenant(billRow, null, { bill_settlement: postgrestError("XX000") }).tenant, "b-1"),
    ).rejects.toMatchObject({ kind: "INTERNAL" });
  });
});

describe("voidBill (plan §15.2; D314)", () => {
  it("voids through void_bill with its reason, and audits the status, the reason and the visit back in To bill", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({
        data: { previously: "ISSUED", visit: { id: "v-1", from: "BILLED", to: "TO_BILL" }, balance_paise: 0 },
      }),
    });
    expect(await voidBill(tenant, "b-1", { reason: "Wrong patient" }, "req_v")).toEqual({
      balancePaise: 0,
      visitToBill: true,
    });
    expect(rpcs).toEqual([{ name: "void_bill", args: { p_bill_id: "b-1", p_reason: "Wrong patient" } }]);
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "UPDATE",
        entityType: "bills",
        entityId: "b-1",
        changes: { status: { from: "ISSUED", to: "VOID" }, void_reason: { from: null, to: "Wrong patient" } },
        requestId: "req_v",
      },
      {
        action: "UPDATE",
        entityType: "visits",
        entityId: "v-1",
        changes: { billing_status: { from: "BILLED", to: "TO_BILL" } },
        requestId: "req_v",
      },
    ]);
  });

  it("audits only the bill when no visit moves, and nothing for one voided already", async () => {
    const plain = tenantWith({ rpc: () => ({ data: { previously: "ISSUED", visit: null, balance_paise: 500 } }) });
    expect(await voidBill(plain.tenant, "b-1", { reason: "Typo" })).toEqual({ balancePaise: 500, visitToBill: false });
    expect(logActionsSafe).toHaveBeenCalledWith(plain.tenant, [expect.objectContaining({ entityType: "bills" })]);

    logActionsSafe.mockClear();
    const again = tenantWith({ rpc: () => ({ data: { previously: "VOID", visit: null, balance_paise: 500 } }) });
    await voidBill(again.tenant, "b-1", { reason: "Typo" });
    expect(logActionsSafe).not.toHaveBeenCalled();
  });

  it("says, in its own words, what it was refused", async () => {
    const { tenant } = tenantWith({ rpc: () => refused("AUTH_PERMISSION_DENIED") });
    await expect(voidBill(tenant, "b-1", { reason: "Typo" })).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});
