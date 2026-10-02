import { afterEach, describe, expect, it, vi } from "vitest";

import { ERROR_MESSAGES } from "@/constants/messages";

import { AppError, KIND_STATUS } from "@/lib/errors/AppError";

describe("AppError", () => {
  it("takes its wording from the catalogue and its status from its kind", () => {
    const error = new AppError({ kind: "CONFLICT", code: "CONFLICT" });

    expect(error.message).toBe(ERROR_MESSAGES.CONFLICT);
    expect(error.httpStatus).toBe(KIND_STATUS.CONFLICT);
    expect(error.traceId).toBeTruthy();
  });

  it("serialises only what is safe to send: no cause, no details", () => {
    const error = new AppError({
      kind: "INTERNAL",
      code: "INTERNAL_ERROR",
      cause: new Error("connection string"),
      details: { table: "orders" },
    });

    expect(Object.keys(error.toJSON()).sort()).toEqual(["code", "message", "traceId"]);
    expect(JSON.stringify(error.toJSON())).not.toContain("orders");
  });
});

describe("AppError's trace id", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is a random UUID where the runtime has one", () => {
    expect(new AppError({ kind: "INTERNAL", code: "INTERNAL_ERROR" }).traceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("is still unique enough to find in the logs where it has none", () => {
    vi.stubGlobal("crypto", {});
    expect(new AppError({ kind: "INTERNAL", code: "INTERNAL_ERROR" }).traceId).toMatch(/^trace_/);
    vi.stubGlobal("crypto", undefined);
    expect(new AppError({ kind: "INTERNAL", code: "INTERNAL_ERROR" }).traceId).toMatch(/^trace_/);
  });
});
