import { beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_LOG_LIMITS } from "@/constants/limits";
import { logger } from "@/lib/logger";
import { fakeSupabase, postgrestError, type FakeAnswer } from "@tests/support/supabase";

const { server } = vi.hoisted(() => ({
  server: { answer: { data: null } as FakeAnswer, fake: null as unknown, throws: false },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => {
    if (server.throws) throw new Error("no service key");
    return (server.fake as ReturnType<typeof fakeSupabase>).client;
  },
}));

const { captureError } = await import("@/lib/audit/errorLog");

/** The row the last capture wrote. */
const written = () =>
  (server.fake as ReturnType<typeof fakeSupabase>).queries.at(-1)!.calls[0][1] as Record<string, unknown>;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(logger, "error").mockImplementation(() => undefined);
  server.fake = fakeSupabase({ answer: () => server.answer });
  server.answer = { data: null };
  server.throws = false;
});

describe("captureError", () => {
  it("keeps the failure with where it happened, an Error's message and stack, and the reference shown", async () => {
    const thrown = new Error("driver said no");
    await captureError({
      message: "API request failed",
      source: "API",
      error: thrown,
      reference: "req_1",
      code: "INTERNAL_ERROR",
      kind: "INTERNAL",
      httpStatus: 500,
      method: "POST",
      path: "/api/patients",
      userId: "user-1",
      clinicId: "clinic-1",
    });
    expect(written()).toEqual({
      source: "API",
      message: "API request failed",
      reference: "req_1",
      code: "INTERNAL_ERROR",
      kind: "INTERNAL",
      http_status: 500,
      method: "POST",
      path: "/api/patients",
      user_id: "user-1",
      clinic_id: "clinic-1",
      detail: "driver said no",
      stack: thrown.stack,
      context: null,
    });
    expect(logger.error).toHaveBeenCalledWith(
      "API request failed",
      expect.objectContaining({ detail: "driver said no" }),
      "req_1",
    );
  });

  it("is the server's own work when no source is said, and keeps nothing it was not given", async () => {
    await captureError({ message: "Something broke" });
    expect(written()).toMatchObject({
      source: "SERVER",
      reference: null,
      detail: null,
      stack: null,
      path: null,
      user_id: null,
    });
  });

  it("writes out a thrown value that is not an Error", async () => {
    await captureError({ message: "m", error: "plain words" });
    expect(written().detail).toBe("plain words");
    await captureError({ message: "m", error: { code: "P0001" } });
    expect(written().detail).toBe('{"code":"P0001"}');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await captureError({ message: "m", error: circular });
    expect(written().detail).toBe("[object Object]");
  });

  it("clips what is too long for its column", async () => {
    await captureError({ message: "m".repeat(600), path: "/p".repeat(200), error: new Error("d".repeat(3000)) });
    const row = written();
    expect((row.message as string).length).toBe(ERROR_LOG_LIMITS.message);
    expect((row.message as string).endsWith("…")).toBe(true);
    expect((row.path as string).length).toBe(ERROR_LOG_LIMITS.path);
    expect((row.detail as string).length).toBe(ERROR_LOG_LIMITS.detail);
  });

  it("redacts a patient's details from the context by key", async () => {
    await captureError({ message: "m", context: { patientName: "Anu Thomas", phone: "+919876543210", count: 3 } });
    const context = written().context as Record<string, unknown>;
    expect(JSON.stringify(context)).not.toMatch(/Anu|9876543210/);
    expect(context.count).toBe(3);
  });

  it("never throws: a row it could not write, or a client it could not make, goes to the output", async () => {
    server.answer = { error: postgrestError("42501") };
    await expect(captureError({ message: "m", reference: "req_2" })).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith("Error log not written", { code: "42501" }, "req_2");

    server.throws = true;
    await expect(captureError({ message: "m" })).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenLastCalledWith("Error log not written", { reason: "no service key" }, undefined);
  });

  it("says a non-Error thrown on the way as itself", async () => {
    server.fake = {
      ...fakeSupabase(),
      client: {
        from: () => {
          throw "offline";
        },
      },
    };
    await captureError({ message: "m" });
    expect(logger.error).toHaveBeenLastCalledWith("Error log not written", { reason: "offline" }, undefined);
  });
});
