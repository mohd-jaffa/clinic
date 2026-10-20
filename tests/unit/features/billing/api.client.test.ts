import { beforeEach, describe, expect, it, vi } from "vitest";

import { BillingClient } from "@/features/billing/api.client";
import type { BillInput, PaymentInput } from "@/lib/validation";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ data: { billId: "b-1" } }) });
});

describe("BillingClient (plan §30)", () => {
  it("issues a bill with its idempotency key (plan §15.2)", async () => {
    const input = { patientId: "p-1" } as unknown as BillInput;
    expect(await BillingClient.issue({ input, key: "key-1" })).toEqual({ billId: "b-1" });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect([url, init.method, init.body]).toEqual(["/api/bills", "POST", JSON.stringify(input)]);
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("key-1");
  });
});

describe("BillingClient.void (plan §15.2; D314)", () => {
  it("voids a bill with its reason", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { balancePaise: 0 } }) });
    expect(await BillingClient.void({ billId: "b-1", input: { reason: "Wrong patient" } })).toEqual({
      balancePaise: 0,
    });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect([url, init.method, init.body]).toEqual([
      "/api/bills/b-1/void",
      "POST",
      JSON.stringify({ reason: "Wrong patient" }),
    ]);
  });
});

describe("BillingClient.record, voidPayment, noCharge (plan §15.3, §15.6; D319, D336)", () => {
  it("records a payment with its idempotency key", async () => {
    const input = { patientId: "p-1", kind: "PAYMENT" } as unknown as PaymentInput;
    await BillingClient.record({ input, key: "key-2" });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect([url, init.method, init.body]).toEqual(["/api/payments", "POST", JSON.stringify(input)]);
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("key-2");
  });

  it("voids a payment, and marks a visit No charge, each with its reason", async () => {
    await BillingClient.voidPayment({ paymentId: "pay-1", input: { reason: "Entered twice" } });
    await BillingClient.noCharge({ visitId: "v-1", input: { reason: "REVIEW", note: "" } });
    expect(mockFetch.mock.calls.map(([url, init]) => [url, (init as RequestInit).body])).toEqual([
      ["/api/payments/pay-1/void", JSON.stringify({ reason: "Entered twice" })],
      ["/api/visits/v-1/no-charge", JSON.stringify({ reason: "REVIEW", note: "" })],
    ]);
  });
});
