// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/constants/permissions";
import type { Tenant } from "@/lib/supabase/tenant";
import type { PaymentPayload } from "@/lib/validation";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionSafe } = vi.hoisted(() => ({ logActionSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe }));

const { getPatientBalance, listOutstanding, listPatientPayments, listPayments, recordPayment, toPayment, voidPayment } =
  await import("@/features/billing/payments");

function tenantWith(options: FakeSupabaseOptions, permissions: Permission[] = ["payments.create"]) {
  const fake = fakeSupabase(options);
  const tenant = {
    supabase: fake.client,
    clinicId: "clinic-1",
    actorId: "user-1",
    role: "STAFF",
    permissions,
  } as unknown as Tenant;
  return { ...fake, tenant };
}

const refused = (hint: string) => ({ error: { ...postgrestError("P0001"), hint } });

const row = {
  id: "pay-1",
  kind: "PAYMENT",
  amount_paise: 50_000,
  method: "UPI",
  reference: "UTR 1",
  paid_at: "2026-10-19T05:30:00Z",
  paid_on: "2026-10-19",
  note: null,
  status: "RECORDED",
  void_reason: null,
  voided_at: null,
  patient: { id: "p-1", full_name: "Asha Rao", patient_number: 1042, archived_at: null },
  receiver: { full_name: "Priya Shah" },
  voider: null,
};

const payment: PaymentPayload = {
  patientId: "p-1",
  kind: "PAYMENT",
  amountPaise: 50_000,
  paidOn: "2026-10-19",
  method: "UPI",
  reference: "UTR 1",
  note: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date("2026-10-19T06:00:00Z"), toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toPayment (D325, D336)", () => {
  it("reads a payment, who took it, and — voided — when, by whom and why", () => {
    expect(toPayment(row as never)).toEqual({
      id: "pay-1",
      kind: "PAYMENT",
      amountPaise: 50_000,
      method: "UPI",
      reference: "UTR 1",
      paidAt: "2026-10-19T05:30:00Z",
      paidOn: "2026-10-19",
      note: null,
      status: "RECORDED",
      receivedBy: "Priya Shah",
      void: null,
      patient: { id: "p-1", name: "Asha Rao", number: 1042, archived: false },
    });
    expect(
      toPayment({
        ...row,
        status: "VOID",
        void_reason: "Entered twice",
        voided_at: "2026-10-19T07:00:00Z",
        receiver: null,
        voider: { full_name: "Asha Menon" },
        patient: { ...row.patient, archived_at: "2026-10-19T08:00:00Z" },
      } as never),
    ).toMatchObject({
      receivedBy: null,
      void: { reason: "Entered twice", at: "2026-10-19T07:00:00Z", by: "Asha Menon" },
      patient: { archived: true },
    });
    expect(toPayment({ ...row, status: "VOID", void_reason: "x", voided_at: "t" } as never).void!.by).toBeNull();
  });
});

describe("listPayments (plan §15.4; D320, D334)", () => {
  it("reads a page of the days asked, from the first one's midnight in India, newest first, one more than a page", async () => {
    const { tenant, queries } = tenantWith({ answer: () => ({ data: [row] }) });
    expect(await listPayments(tenant, { from: "2026-10-01", to: "2026-10-19", cursor: 20 })).toEqual({
      items: [expect.objectContaining({ id: "pay-1", receivedBy: "Priya Shah" })],
      nextCursor: null,
    });
    expect(queries[0].table).toBe("payments");
    expect(queries[0].calls).toEqual([
      ["select", expect.stringContaining("receiver:profiles!payments_received_by_fkey(full_name)")],
      ["eq", "clinic_id", "clinic-1"],
      ["gte", "paid_at", "2026-09-30T18:30:00.000Z"],
      ["lt", "paid_at", "2026-10-19T18:30:00.000Z"],
      ["order", "paid_at", { ascending: false }],
      ["order", "id", { ascending: false }],
      ["range", 20, 40],
    ]);
  });

  it("starts at the first page, and says what it was refused", async () => {
    const first = tenantWith({ answer: () => ({ data: [] }) });
    await listPayments(first.tenant, { from: "2026-10-19", to: "2026-10-19", cursor: undefined });
    expect(first.queries[0].calls.at(-1)).toEqual(["range", 0, 20]);
    const down = tenantWith({ answer: () => ({ error: postgrestError("XX000") }) });
    await expect(listPayments(down.tenant, { from: "2026-10-19", to: "2026-10-19" })).rejects.toBeDefined();
  });
});

describe("recordPayment (plan §15.3; D297, D299, D334)", () => {
  it("records today's payment as now, once per key, and audits its kind, amount, method and day", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({ data: { payment_id: "pay-1", created: true, balance_paise: 30_000 } }),
    });
    expect(await recordPayment(tenant, payment, "key-1", "req_p")).toEqual({
      paymentId: "pay-1",
      balancePaise: 30_000,
    });
    expect(rpcs).toEqual([
      {
        name: "record_payment",
        args: {
          p_payment: {
            patient_id: "p-1",
            kind: "PAYMENT",
            amount_paise: 50_000,
            method: "UPI",
            reference: "UTR 1",
            paid_at: null,
            note: null,
          },
          p_idempotency_key: "key-1",
        },
      },
    ]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "CREATE",
      entityType: "payments",
      entityId: "pay-1",
      changes: {
        kind: { from: null, to: "PAYMENT" },
        amount_paise: { from: null, to: 50_000 },
        method: { from: null, to: "UPI" },
        paid_on: { from: null, to: "2026-10-19" },
      },
      requestId: "req_p",
    });
  });

  it("stamps an earlier day's payment at that day's noon in India (D334), and audits nothing sent again", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({ data: { payment_id: "pay-1", created: false, balance_paise: 30_000 } }),
    });
    await recordPayment(tenant, { ...payment, paidOn: "2026-10-12" }, "key-1");
    expect((rpcs[0].args as { p_payment: { paid_at: string } }).p_payment.paid_at).toBe("2026-10-12T06:30:00.000Z");
    expect(logActionSafe).not.toHaveBeenCalled();
  });

  it("records a refund for payments.edit only, as the database does too", async () => {
    const refund = { ...payment, kind: "REFUND" as const };
    const desk = tenantWith({ rpc: () => ({ data: null }) });
    await expect(recordPayment(desk.tenant, refund, "key-1")).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    expect(desk.rpcs).toEqual([]);

    const owner = tenantWith({ rpc: () => ({ data: { payment_id: "pay-2", created: true, balance_paise: 0 } }) }, [
      "payments.create",
      "payments.edit",
    ]);
    expect(await recordPayment(owner.tenant, refund, "key-2")).toEqual({ paymentId: "pay-2", balancePaise: 0 });
  });

  it("says, in its own words, what it was refused", async () => {
    const { tenant } = tenantWith({ rpc: () => refused("PAYMENT_REFUND_TOO_LARGE") });
    await expect(recordPayment(tenant, payment, "key-1")).rejects.toMatchObject({ code: "PAYMENT_REFUND_TOO_LARGE" });
  });
});

describe("voidPayment (plan §15.3; D301, D336)", () => {
  it("voids through void_payment with its reason, and audits it once", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: { previously: "RECORDED", balance_paise: 50_000 } }) });
    expect(await voidPayment(tenant, "pay-1", { reason: "Entered twice" }, "req_v")).toEqual({ balancePaise: 50_000 });
    expect(rpcs).toEqual([{ name: "void_payment", args: { p_payment_id: "pay-1", p_reason: "Entered twice" } }]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "UPDATE",
      entityType: "payments",
      entityId: "pay-1",
      changes: { status: { from: "RECORDED", to: "VOID" }, void_reason: { from: null, to: "Entered twice" } },
      requestId: "req_v",
    });

    logActionSafe.mockClear();
    const again = tenantWith({ rpc: () => ({ data: { previously: "VOID", balance_paise: 50_000 } }) });
    await voidPayment(again.tenant, "pay-1", { reason: "Again" });
    expect(logActionSafe).not.toHaveBeenCalled();
  });

  it("says, in its own words, what it was refused", async () => {
    const { tenant } = tenantWith({ rpc: () => refused("PAYMENT_HAS_REFUNDS") });
    await expect(voidPayment(tenant, "pay-1", { reason: "x" })).rejects.toMatchObject({ code: "PAYMENT_HAS_REFUNDS" });
  });
});

describe("listOutstanding (plan §15.4; D321)", () => {
  it("reads a page of who owes, most first, archived ones too", async () => {
    const { tenant, queries } = tenantWith({
      answer: () => ({
        data: [
          {
            balance_paise: 120_000,
            patient: {
              id: "p-1",
              full_name: "Asha Rao",
              patient_number: 1042,
              phone: "+919876543210",
              date_of_birth: "1990-01-01",
              gender: "FEMALE",
              archived_at: "2026-10-01T00:00:00Z",
            },
          },
        ],
      }),
    });
    expect(await listOutstanding(tenant, { cursor: undefined })).toEqual({
      items: [
        {
          patient: {
            id: "p-1",
            name: "Asha Rao",
            number: 1042,
            phone: "+919876543210",
            dateOfBirth: "1990-01-01",
            gender: "FEMALE",
            archived: true,
          },
          balancePaise: 120_000,
        },
      ],
      nextCursor: null,
    });
    expect(queries[0].table).toBe("patient_balances");
    expect(queries[0].calls).toEqual([
      ["select", expect.stringContaining("patient:patients!patient_balances_patient_id_clinic_id_fkey(")],
      ["eq", "clinic_id", "clinic-1"],
      ["gt", "balance_paise", 0],
      ["order", "balance_paise", { ascending: false }],
      ["order", "patient_id"],
      ["range", 0, 20],
    ]);
  });

  it("reads on from a cursor, and says what it was refused", async () => {
    const next = tenantWith({ answer: () => ({ data: [] }) });
    await listOutstanding(next.tenant, { cursor: 20 });
    expect(next.queries[0].calls.at(-1)).toEqual(["range", 20, 40]);
    const down = tenantWith({ answer: () => ({ error: postgrestError("XX000") }) });
    await expect(listOutstanding(down.tenant, {})).rejects.toBeDefined();
  });
});

describe("listPatientPayments (plan §10.3; D325, D336)", () => {
  it("reads a page of a patient's payments for their history, newest first, one more than a page", async () => {
    const { tenant, queries } = tenantWith({ answer: () => ({ data: [row] }) });
    expect(await listPatientPayments(tenant, "p-1", 20)).toEqual([
      expect.objectContaining({ id: "pay-1", amountPaise: 50_000, method: "UPI", receivedBy: "Priya Shah" }),
    ]);
    expect(queries[0].table).toBe("payments");
    expect(queries[0].calls).toEqual([
      ["select", expect.stringContaining("patient:patients!payments_patient_id_clinic_id_fkey(")],
      ["eq", "clinic_id", "clinic-1"],
      ["eq", "patient_id", "p-1"],
      ["order", "paid_at", { ascending: false }],
      ["order", "id", { ascending: false }],
      ["range", 20, 40],
    ]);
  });

  it("starts at the first page, and says what it was refused", async () => {
    const first = tenantWith({ answer: () => ({ data: [] }) });
    await listPatientPayments(first.tenant, "p-1");
    expect(first.queries[0].calls.at(-1)).toEqual(["range", 0, 20]);
    const down = tenantWith({ answer: () => ({ error: postgrestError("XX000") }) });
    await expect(listPatientPayments(down.tenant, "p-1")).rejects.toBeDefined();
  });
});

describe("getPatientBalance (plan §15.4; D295)", () => {
  it("reads a patient's balance, and nothing for one never billed or paid", async () => {
    const owing = tenantWith({ answer: () => ({ data: { balance_paise: 30_000 } }) });
    expect(await getPatientBalance(owing.tenant, "p-1")).toBe(30_000);
    expect(owing.queries[0].table).toBe("patient_balances");
    expect(owing.queries[0].calls).toEqual([
      ["select", "balance_paise"],
      ["eq", "clinic_id", "clinic-1"],
      ["eq", "patient_id", "p-1"],
      ["maybeSingle"],
    ]);
    expect(await getPatientBalance(tenantWith({ answer: () => ({ data: null }) }).tenant, "p-1")).toBe(0);
  });

  it("says what it was refused", async () => {
    const down = tenantWith({ answer: () => ({ error: postgrestError("XX000") }) });
    await expect(getPatientBalance(down.tenant, "p-1")).rejects.toBeDefined();
  });
});
