import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AppError, internalError, validationError } from "@/lib/errors";
import { captureError } from "@/lib/audit/errorLog";
import { logger } from "@/lib/logger";

import { createRequestId, normalizeApiError, readBody, readJson, readQuery, withApiHandler } from "@/lib/api/handler";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/audit/errorLog", () => ({ captureError: vi.fn() }));

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://x.test/api/thing", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("createRequestId", () => {
  it("keeps the id the caller sent, so one request has one id end to end", () => {
    expect(createRequestId(new Headers({ "x-request-id": "req_upstream" }))).toBe("req_upstream");
  });

  it("makes one when the caller sent none", () => {
    expect(createRequestId(new Headers())).toMatch(/^req_/);
  });
});

describe("readJson", () => {
  it("returns the parsed body when a schema is given", async () => {
    const schema = z.object({ name: z.string() });
    await expect(readJson(post({ name: "Meena" }), schema)).resolves.toEqual({ name: "Meena" });
  });

  it("refuses a body that is not JSON", async () => {
    await expect(readJson(post("{not json"))).rejects.toMatchObject({
      code: "VALIDATION_INVALID_JSON",
    });
  });

  it("lets a schema failure through as a ZodError", async () => {
    const schema = z.object({ name: z.string() });
    await expect(readJson(post({ name: 7 }), schema)).rejects.toBeInstanceOf(z.ZodError);
  });

  it("hands back the body as it came when no schema is named", async () => {
    await expect(readJson(post({ any: ["shape"] }))).resolves.toEqual({ any: ["shape"] });
  });
});

describe("readQuery", () => {
  const schema = z.object({ period: z.string().optional(), status: z.string().optional() });

  it("hands the query to the schema, an empty value as absent and a repeat as its first", () => {
    const request = new Request("http://x/api/dashboard?period=WEEK&status=&period=MONTH");
    expect(readQuery(request, schema)).toEqual({ period: "WEEK" });
  });

  it("lets a schema failure through as a ZodError", () => {
    expect(() => readQuery(new Request("http://x/?period=1"), z.object({ period: z.enum(["WEEK"]) }))).toThrow(
      z.ZodError,
    );
  });
});

describe("readBody", () => {
  const limit = { maxBytes: 8, tooLarge: "LOGO_TOO_LARGE" as const };

  /** A body arriving in pieces, with no length declared — as a chunked upload does. */
  function streamed(...chunks: number[][]) {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
        controller.close();
      },
    });
    return new Request("https://x.test/api/upload", { method: "POST", body, duplex: "half" } as RequestInit);
  }

  it("returns the bytes, joined in order", async () => {
    await expect(readBody(streamed([1, 2, 3], [4, 5]), limit)).resolves.toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it("accepts a body of exactly the limit", async () => {
    await expect(readBody(streamed([1, 2, 3, 4], [5, 6, 7, 8]), limit)).resolves.toHaveLength(8);
  });

  it("refuses a body that declares more than the limit before reading any of it", async () => {
    const request = new Request("https://x.test/api/upload", {
      method: "POST",
      body: new Uint8Array(4),
      headers: { "content-length": "9000" },
    });
    await expect(readBody(request, limit)).rejects.toMatchObject({ code: "LOGO_TOO_LARGE", httpStatus: 400 });
    expect(request.bodyUsed).toBe(false);
  });

  it("reads a body that declares a length within the limit", async () => {
    const request = new Request("https://x.test/api/upload", {
      method: "POST",
      body: new Uint8Array([1, 2, 3]),
      headers: { "content-length": "3" },
    });
    await expect(readBody(request, limit)).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });

  it("refuses a body that turns out larger than it said, or said nothing", async () => {
    await expect(readBody(streamed([1, 2, 3, 4, 5], [6, 7, 8, 9]), limit)).rejects.toMatchObject({
      code: "LOGO_TOO_LARGE",
    });
  });

  it("reads no body as empty", async () => {
    await expect(readBody(new Request("https://x.test/api/upload", { method: "POST" }), limit)).resolves.toHaveLength(
      0,
    );
  });
});

describe("normalizeApiError", () => {
  it("turns a schema failure into a validation error naming each field", () => {
    const failure = z.object({ name: z.string() }).safeParse({});
    const error = normalizeApiError(failure.success ? null : failure.error);

    expect(error.kind).toBe("VALIDATION");
    expect(error.details).toEqual([{ path: "name", message: expect.any(String) }]);
  });

  it("passes an AppError through unchanged", () => {
    const original = validationError("VALIDATION_ERROR");
    expect(normalizeApiError(original)).toBe(original);
  });

  it("treats anything else as internal, keeping the cause off the response", () => {
    const error = normalizeApiError(new Error("a column is missing"));
    expect(error.kind).toBe("INTERNAL");
    expect(error.message).not.toContain("column");
  });
});

describe("withApiHandler", () => {
  it("answers success in the standard envelope", async () => {
    const response = await withApiHandler(post({}), async () => ({ id: "c-1" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: { id: "c-1" } });
  });

  it("uses the status the route asked for", async () => {
    const response = await withApiHandler(post({}), async () => ({ id: "c-1" }), {
      successStatus: 201,
    });
    expect(response.status).toBe(201);
  });

  it("answers a refusal in the failure envelope, with the request id", async () => {
    const request = post({}, { "x-request-id": "req_abc" });
    const response = await withApiHandler(request, async () => {
      throw validationError("VALIDATION_ERROR");
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBe("req_abc");
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR", requestId: "req_abc" },
    });
  });

  it("hands back a route's own response untouched — a file, not the envelope", async () => {
    const file = new Response("png", { headers: { "content-type": "image/png" } });
    const response = await withApiHandler(post({}), async () => file);
    expect(response).toBe(file);
  });

  it("never returns the internals of an unexpected failure", async () => {
    const response = await withApiHandler(post({}), async () => {
      throw new Error('relation "patients" does not exist');
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("patients");
  });

  it("sends a fault of the server's own to the error log, under the reference the person is shown", async () => {
    vi.mocked(captureError).mockClear();
    const driver = new Error("connection terminated");
    const request = new Request("https://x.test/api/appointments?search=Anu", {
      method: "POST",
      headers: { "x-request-id": "req_9" },
    });
    await withApiHandler(request, async () => {
      throw internalError("INTERNAL_ERROR", undefined, driver);
    });
    expect(captureError).toHaveBeenCalledExactlyOnceWith({
      source: "API",
      message: "API request failed",
      error: driver,
      reference: "req_9",
      kind: "INTERNAL",
      code: "INTERNAL_ERROR",
      httpStatus: 500,
      method: "POST",
      path: "/api/appointments",
      userId: undefined,
      clinicId: undefined,
      context: { traceId: expect.any(String), details: undefined },
    });
  });

  it("names who was asking once the route knows, and a failure with no cause logs itself", async () => {
    vi.mocked(captureError).mockClear();
    await withApiHandler(post({}), async (context) => {
      context.asker = { userId: "u-1", clinicId: "c-1" };
      throw internalError("INTERNAL_ERROR");
    });
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u-1", clinicId: "c-1", error: expect.any(AppError) }),
    );
  });

  it("keeps a refusal out of the error log, its cause in the output only, never in the answer", async () => {
    vi.mocked(captureError).mockClear();
    const response = await withApiHandler(post({}, { "x-request-id": "req_409" }), async () => {
      throw new AppError({ kind: "CONFLICT", code: "CONFLICT", cause: new Error("duplicate key value") });
    });
    expect(captureError).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenLastCalledWith(
      "API request refused",
      expect.objectContaining({ httpStatus: 409, cause: "duplicate key value" }),
      "req_409",
    );
    expect(JSON.stringify(await response.json())).not.toContain("duplicate key");
  });

  it("logs a refusal with no cause as having none", async () => {
    await withApiHandler(post({}), async () => {
      throw validationError("VALIDATION_ERROR");
    });
    expect(logger.warn).toHaveBeenLastCalledWith(
      "API request refused",
      expect.objectContaining({ httpStatus: 400, cause: undefined }),
      expect.any(String),
    );
  });
});
