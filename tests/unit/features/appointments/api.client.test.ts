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

  it("changes one — its notes, or moved — and sets its status, each in the body", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { id: "a-1" } }) });
    await AppointmentsClient.change({ id: "a-1", input: { notes: "Bring reports" } });
    await AppointmentsClient.setStatus({ id: "a-1", status: "CANCELLED", reason: "Patient asked" });
    const sent = (mockFetch.mock.calls as [string, RequestInit][]).map(([url, init]) => [url, init.method, init.body]);
    expect(sent).toEqual([
      ["/api/appointments/a-1", "PATCH", JSON.stringify({ notes: "Bring reports" })],
      ["/api/appointments/a-1/status", "POST", JSON.stringify({ status: "CANCELLED", reason: "Patient asked" })],
    ]);
  });

  it("marks a patient arrived, and adds a walk-in once per key — the patient in the body (D98)", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { token: 7 } }) });
    expect(await AppointmentsClient.arrive("a-1")).toEqual({ token: 7 });
    const input = { patient: { mode: "FOUND" as const, id: "p-1" }, doctorId: "d-1", typeId: "t-1" };
    await AppointmentsClient.addWalkIn({ input, key: "3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f" });
    const [[arrived, arrivedInit], [walked, walkedInit]] = mockFetch.mock.calls as [string, RequestInit][];
    expect([arrived, arrivedInit.method]).toEqual(["/api/appointments/a-1/arrived", "POST"]);
    expect([walked, walkedInit.method, walkedInit.body]).toEqual([
      "/api/appointments/walk-in",
      "POST",
      JSON.stringify(input),
    ]);
    expect((walkedInit.headers as Record<string, string>)["Idempotency-Key"]).toBe(
      "3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f",
    );
  });

  it("notes a reminder sent", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { remindedAt: "now" } }) });
    expect(await AppointmentsClient.remind("a-1")).toEqual({ remindedAt: "now" });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect([url, init.method]).toEqual(["/api/appointments/a-1/reminded", "POST"]);
  });

  it("moves the queue, each move's ids in the body (plan §11.4)", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: {} }) });
    await AppointmentsClient.sendIn({ appointmentId: "a-1", others: "KEEP" });
    await AppointmentsClient.done("a-1");
    await AppointmentsClient.next({ doctorId: "d-1", appointmentId: "a-1" });
    await AppointmentsClient.backToWaiting("a-1");
    await AppointmentsClient.stepOut({ appointmentId: "a-1", out: true });
    await AppointmentsClient.urgent({ appointmentId: "a-1", urgent: true });
    const sent = (mockFetch.mock.calls as [string, RequestInit][]).map(([url, init]) => [url, init.method, init.body]);
    expect(sent).toEqual([
      ["/api/queue/send-in", "POST", JSON.stringify({ appointmentId: "a-1", others: "KEEP" })],
      ["/api/queue/done", "POST", JSON.stringify({ appointmentId: "a-1" })],
      ["/api/queue/next", "POST", JSON.stringify({ doctorId: "d-1", appointmentId: "a-1" })],
      ["/api/queue/waiting", "POST", JSON.stringify({ appointmentId: "a-1" })],
      ["/api/queue/stepped-out", "POST", JSON.stringify({ appointmentId: "a-1", out: true })],
      ["/api/queue/urgent", "POST", JSON.stringify({ appointmentId: "a-1", urgent: true })],
    ]);
  });
});
