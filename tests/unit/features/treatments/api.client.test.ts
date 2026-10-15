import { beforeEach, describe, expect, it, vi } from "vitest";

import { FollowUpsClient, TreatmentsClient } from "@/features/treatments/api.client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { ok: true } }) });
});

const sent = () => {
  const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  return [url, init.method, init.body];
};

describe("TreatmentsClient (plan §30)", () => {
  it("adds one", async () => {
    const input = {
      patientId: "p-1",
      visitId: null,
      doctorId: "d-1",
      start: "PLANNED" as const,
      name: "Crown",
      description: "",
      estimatedCost: "",
      note: "",
      nextDueOn: "",
    };
    await TreatmentsClient.create(input);
    expect(sent()).toEqual(["/api/treatments", "POST", JSON.stringify(input)]);
  });

  it("changes one, and moves it", async () => {
    const input = { part: "NEXT_DUE" as const, changes: { nextDueOn: "" }, seen: { nextDueOn: null } };
    await TreatmentsClient.change({ id: "t-1", input });
    expect(sent()).toEqual(["/api/treatments/t-1", "PATCH", JSON.stringify(input)]);
    mockFetch.mockClear();
    await TreatmentsClient.setStatus({ id: "t-1", input: { status: "ON_HOLD", seen: "PLANNED" } });
    expect(sent()).toEqual(["/api/treatments/t-1/status", "POST", '{"status":"ON_HOLD","seen":"PLANNED"}']);
  });

  it("saves a visit's session on one, and removes it", async () => {
    const input = { note: "Canal filled", complete: true, seen: null };
    await TreatmentsClient.recordSession({ id: "t-1", visitId: "v-1", input });
    expect(sent()).toEqual(["/api/treatments/t-1/sessions/v-1", "PUT", JSON.stringify(input)]);
    mockFetch.mockClear();
    await TreatmentsClient.removeSession({ id: "t-1", visitId: "v-1" });
    expect(sent().slice(0, 2)).toEqual(["/api/treatments/t-1/sessions/v-1", "DELETE"]);
  });
});

describe("FollowUpsClient (plan §30)", () => {
  it("notes a contact", async () => {
    const input = { kind: "TREATMENT" as const, id: "t-1", outcome: "REACHED" as const, note: "", snoozeUntil: "" };
    await FollowUpsClient.note(input);
    expect(sent()).toEqual(["/api/follow-ups/contacts", "POST", JSON.stringify(input)]);
  });
});
