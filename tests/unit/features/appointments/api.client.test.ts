import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppointmentsClient } from "@/features/appointments/api.client";
import type { BookingInput } from "@/lib/validation";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ data: { id: "a-1" } }) });
});

describe("AppointmentsClient (plan §30)", () => {
  it("books once per key, as typed — the patient in the body (D98)", async () => {
    const input = { patient: { mode: "FOUND", id: "p-1" } } as BookingInput;
    expect(await AppointmentsClient.book({ input, key: "3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f" })).toEqual({
      id: "a-1",
    });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect({ url, method: init.method, body: init.body }).toEqual({
      url: "/api/appointments",
      method: "POST",
      body: JSON.stringify(input),
    });
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f");
  });
});
