import { beforeEach, describe, expect, it, vi } from "vitest";

import { BillingClient } from "@/features/billing/api.client";
import type { BillInput } from "@/lib/validation";

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
