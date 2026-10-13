import { beforeEach, describe, expect, it, vi } from "vitest";

import { VisitsClient } from "@/features/visits/api.client";
import type { SaveVitalsInput } from "@/lib/validation";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { visitId: "v-1" } }) });
});

const input = { vitals: { pulse: "72" }, seen: null } as unknown as SaveVitalsInput;
const sent = () =>
  (mockFetch.mock.calls as [string, RequestInit][]).map(([url, init]) => [url, init.method, init.body]);

describe("VisitsClient (plan §30)", () => {
  it("saves each section alone, with what was read of it (D202, D206), and a waiting patient's vitals (D203)", async () => {
    expect(await VisitsClient.saveVitals({ id: "v-1", input })).toEqual({ visitId: "v-1" });
    await VisitsClient.saveWaitingVitals({ appointmentId: "a-1", input });
    const notes = {
      section: "NOTES",
      changes: { complaint: "Fever", diagnosis: "", notes: "" },
      seen: { complaint: null, diagnosis: null, notes: null },
    } as const;
    await VisitsClient.change({ id: "v-1", input: notes });
    expect(sent()).toEqual([
      ["/api/visits/v-1/vitals", "PUT", JSON.stringify(input)],
      ["/api/appointments/a-1/vitals", "PUT", JSON.stringify(input)],
      ["/api/visits/v-1", "PATCH", JSON.stringify(notes)],
    ]);
  });

  it("starts a visit from a profile, and marks it done (D204)", async () => {
    const start = { patientId: "p-1", doctorId: "d-1" };
    await VisitsClient.start(start);
    await VisitsClient.done("v-1");
    expect(sent()).toEqual([
      ["/api/visits", "POST", JSON.stringify(start)],
      ["/api/visits/v-1/done", "POST", undefined],
    ]);
  });
});
