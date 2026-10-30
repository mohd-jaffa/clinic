import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConsoleClient } from "@/features/admin/api.client";
import type { ExtendPlanInput } from "@/lib/validation";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { emailSent: true } }) });
});

describe("ConsoleClient (plan §30)", () => {
  it("extends a clinic's plan with its idempotency key (plan §7.4)", async () => {
    const input = { kind: "MONTHLY", amount: "300" } as ExtendPlanInput;
    expect(await ConsoleClient.extend({ clinicId: "c-1", input, key: "key-1" })).toEqual({ emailSent: true });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect([url, init.method, init.body]).toEqual(["/api/admin/clinics/c-1/extend", "POST", JSON.stringify(input)]);
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("key-1");
  });
});
