import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeAnswer } from "@tests/support/supabase";

const { server, captureError } = vi.hoisted(() => ({
  server: { answer: { data: null } as FakeAnswer, fake: null as unknown as ReturnType<typeof fakeSupabase> },
  captureError: vi.fn(async () => undefined),
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: () => server.fake.client }));
vi.mock("@/lib/audit/errorLog", () => ({ captureError }));

const { logActionSafe, logActionsSafe } = await import("@/lib/audit/auditLog");

const tenant = { clinicId: "clinic-1", actorId: "user-1" } as Tenant;

beforeEach(() => {
  server.fake = fakeSupabase({ answer: () => server.answer });
  server.answer = { data: null };
  captureError.mockClear();
});

describe("logActionSafe", () => {
  it("writes the row with the tenant's clinic and actor, never the entry's", async () => {
    await logActionSafe(tenant, {
      action: "UPDATE",
      entityType: "services",
      entityId: "service-1",
      changes: { price_paise: { from: 0, to: 50_000 } },
      summary: "Price changed",
      requestId: "req_1",
    });
    expect(server.fake.find("audit_logs", "insert")!.calls[0]).toEqual([
      "insert",
      {
        clinic_id: "clinic-1",
        actor_id: "user-1",
        action: "UPDATE",
        entity_type: "services",
        entity_id: "service-1",
        changes: { price_paise: { from: 0, to: 50_000 } },
        summary: "Price changed",
        request_id: "req_1",
      },
    ]);
  });

  it("stores what was left out as nothing", async () => {
    await logActionSafe(tenant, { action: "ARCHIVE", entityType: "services", entityId: "service-1" });
    expect(server.fake.find("audit_logs", "insert")!.calls[0][1]).toMatchObject({
      changes: null,
      summary: null,
      request_id: null,
    });
  });

  it("logs a row it could not write instead of failing the request", async () => {
    server.answer = { error: postgrestError("23514") };
    await expect(
      logActionSafe(tenant, { action: "CREATE", entityType: "services", entityId: null, requestId: "req_2" }),
    ).resolves.toBeUndefined();
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to write audit log",
        userId: "user-1",
        clinicId: "clinic-1",
        reference: "req_2",
        context: { action: "CREATE", entityType: "services", entityId: null },
      }),
    );

    await logActionSafe(tenant, { action: "CREATE", entityType: "services", entityId: null });
    expect(captureError).toHaveBeenLastCalledWith(expect.objectContaining({ reference: undefined }));
  });
});

describe("logActionsSafe", () => {
  it("writes the rows of one change in one insert, each with the tenant's clinic and actor", async () => {
    await logActionsSafe(tenant, [
      { action: "STATUS_CHANGE", entityType: "appointments", entityId: "a-1", requestId: "req_3" },
      { action: "CREATE", entityType: "visits", entityId: "v-1", changes: { status: { from: null, to: "OPEN" } } },
    ]);
    const calls = server.fake.find("audit_logs", "insert")!.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual([
      expect.objectContaining({ clinic_id: "clinic-1", actor_id: "user-1", entity_id: "a-1", request_id: "req_3" }),
      expect.objectContaining({
        clinic_id: "clinic-1",
        actor_id: "user-1",
        entity_id: "v-1",
        changes: { status: { from: null, to: "OPEN" } },
      }),
    ]);
  });

  it("writes nothing when nothing changed", async () => {
    await logActionsSafe(tenant, []);
    expect(server.fake.find("audit_logs", "insert")).toBeUndefined();
  });

  it("logs rows it could not write instead of failing the request, naming the first", async () => {
    server.answer = { error: postgrestError("23514") };
    await expect(
      logActionsSafe(tenant, [{ action: "DELETE", entityType: "visits", entityId: "v-2", requestId: "req_4" }]),
    ).resolves.toBeUndefined();
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "req_4",
        context: { action: "DELETE", entityType: "visits", entityId: "v-2" },
      }),
    );
  });
});
