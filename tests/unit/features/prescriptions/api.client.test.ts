import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrescriptionsClient } from "@/features/prescriptions/api.client";
import type { SavePrescriptionInput } from "@/lib/validation";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { prescription: null } }) });
});

describe("PrescriptionsClient (plan §30)", () => {
  it("saves the whole prescription with what was read of it (D210, D206)", async () => {
    const input: SavePrescriptionInput = {
      prescription: { items: [], advice: "Rest", printDiagnosis: false },
      seen: null,
    };
    expect(await PrescriptionsClient.save({ visitId: "v-1", input })).toEqual({ prescription: null });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect([url, init.method, init.body]).toEqual(["/api/visits/v-1/prescription", "PUT", JSON.stringify(input)]);
  });
});
