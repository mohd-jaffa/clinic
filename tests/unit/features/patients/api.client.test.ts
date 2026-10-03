import { beforeEach, describe, expect, it, vi } from "vitest";

import { PatientsClient } from "@/features/patients/api.client";
import type { PatientInput } from "@/lib/validation";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { id: "p-1" } }) });
});

const sent = () => {
  const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  return { url, method: init.method, body: init.body, headers: init.headers as Record<string, string> };
};

describe("PatientsClient (plan §30)", () => {
  it("adds a patient once per key, as typed", async () => {
    const input = { fullName: "Rohan", phone: "98765 43210" } as PatientInput;
    expect(await PatientsClient.create({ input, key: "3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f" })).toEqual({ id: "p-1" });
    expect(sent()).toMatchObject({ url: "/api/patients", method: "POST", body: JSON.stringify(input) });
    expect(sent().headers["Idempotency-Key"]).toBe("3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f");
  });

  it("changes one at its own address, with only what changed", async () => {
    await PatientsClient.update({ id: "p-1", fullName: "Rohan M" });
    expect(sent()).toMatchObject({
      url: "/api/patients/p-1",
      method: "PATCH",
      body: JSON.stringify({ fullName: "Rohan M" }),
    });
  });
});
