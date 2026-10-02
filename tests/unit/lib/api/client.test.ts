import { describe, it, expect, vi, beforeEach } from "vitest";
import { ERROR_MESSAGES } from "@/constants/messages";
import {
  ApiError,
  deleteJson,
  fetcher,
  getFile,
  getJson,
  patchJson,
  postFile,
  postOnce,
  postJson,
  putJson,
  resetSessionRefresh,
} from "@/lib/api/client";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockFetchSuccess(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data }),
  });
}

function mockFetchError(status: number, code: string, message: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: { code, message } }),
  });
}

describe("fetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully returns data on successful response", async () => {
    const expectedData = { id: "test-1", name: "Test Item" };
    mockFetchSuccess(expectedData);

    const result = await fetcher<typeof expectedData>("/api/test");

    expect(mockFetch).toHaveBeenCalledWith("/api/test", {
      headers: {
        "Content-Type": "application/json",
      },
    });
    expect(result).toEqual(expectedData);
  });

  it("includes custom headers and method in request", async () => {
    const expectedData = { success: true };
    mockFetchSuccess(expectedData);

    const result = await fetcher("/api/test", {
      method: "POST",
      headers: {
        Authorization: "Bearer token123",
      },
      body: JSON.stringify({ key: "value" }),
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token123",
      },
      body: JSON.stringify({ key: "value" }),
    });
    expect(result).toEqual(expectedData);
  });

  it("throws ApiError with status, code, and message on error response", async () => {
    mockFetchError(400, "INVALID_INPUT", "Validation failed");

    await expect(fetcher("/api/test")).rejects.toThrow("Validation failed");

    mockFetchError(404, "NOT_FOUND", "Resource not found");
    try {
      await fetcher("/api/test");
      expect.unreachable("Should have thrown ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.name).toBe("ApiError");
      expect(apiErr.status).toBe(404);
      expect(apiErr.code).toBe("NOT_FOUND");
      expect(apiErr.message).toBe("Resource not found");
    }
  });

  it("falls back to default error code and message when not provided in error body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    try {
      await fetcher("/api/test");
      expect.unreachable("Should have thrown ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.code).toBe("UNKNOWN_ERROR");
      expect(apiErr.message).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    }
  });

  it("handles response where json parsing fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("Bad JSON");
      },
    });

    try {
      await fetcher("/api/test");
      expect.unreachable("Should have thrown ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(502);
      expect(apiErr.code).toBe("UNKNOWN_ERROR");
      expect(apiErr.message).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    }
  });
});

describe("the JSON verbs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("postJson sends the payload as a JSON body", async () => {
    mockFetchSuccess({ id: "c-1" });

    await expect(postJson("/api/customers", { name: "Meena" })).resolves.toEqual({ id: "c-1" });
    expect(mockFetch).toHaveBeenCalledWith("/api/customers", {
      method: "POST",
      body: JSON.stringify({ name: "Meena" }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("patchJson sends the payload as a JSON body", async () => {
    mockFetchSuccess({ id: "c-1" });

    await patchJson("/api/customers/c-1", { name: "Meena G" });
    expect(mockFetch).toHaveBeenCalledWith("/api/customers/c-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Meena G" }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("putJson sends the whole thing as a JSON body", async () => {
    mockFetchSuccess({ id: "o-1" });

    await putJson("/api/appointments/o-1", { notes: "Ring twice" });
    expect(mockFetch).toHaveBeenCalledWith("/api/appointments/o-1", {
      method: "PUT",
      body: JSON.stringify({ notes: "Ring twice" }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("deleteJson sends no body", async () => {
    mockFetchSuccess({ deleted: true });

    await deleteJson("/api/expenses/e-1");
    expect(mockFetch).toHaveBeenCalledWith("/api/expenses/e-1", {
      method: "DELETE",
      body: undefined,
      headers: { "Content-Type": "application/json" },
    });
  });

  it("postFile sends the file itself as the body, with its own type", async () => {
    mockFetchSuccess({ logoUrl: "/api/business/logo?v=1" });
    const file = new Blob(["png"], { type: "image/png" });

    await postFile("/api/business/logo", file);
    expect(mockFetch).toHaveBeenCalledWith("/api/business/logo", {
      method: "POST",
      body: file,
      headers: { "Content-Type": "image/png" },
    });
  });

  it("postFile names a file of no type as plain bytes", async () => {
    mockFetchSuccess({});
    await postFile("/api/business/logo", new Blob(["?"]));
    expect(mockFetch.mock.calls[0][1].headers).toEqual({ "Content-Type": "application/octet-stream" });
  });

  it("getJson reads without a method", async () => {
    mockFetchSuccess([{ id: "c-1" }]);

    await expect(getJson("/api/customers")).resolves.toEqual([{ id: "c-1" }]);
  });

  it("postOnce sends the idempotency key beside the JSON body", async () => {
    mockFetchSuccess({ id: "o-1" });

    await postOnce("/api/appointments", { items: [] }, "k-1");
    expect(mockFetch).toHaveBeenCalledWith("/api/appointments", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
      headers: { "Content-Type": "application/json", "Idempotency-Key": "k-1" },
    });
  });

  it("keeps what a refusal names, such as the appointment it clashed with", async () => {
    const details = { clashesWith: "10:30" };
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        error: { code: "CONFLICT", message: "Taken", requestId: "req_2", details },
      }),
    });

    await expect(postJson("/api/appointments", {})).rejects.toMatchObject({ code: "CONFLICT", details });
  });

  it("keeps the request id a failure was reported under", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: "CONFLICT", message: "Clash", requestId: "req_9" } }),
    });

    await expect(getJson("/api/appointments")).rejects.toMatchObject({ requestId: "req_9", code: "CONFLICT" });
  });
});

describe("an expired session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSessionRefresh();
  });

  it("refreshes once and sends the request again", async () => {
    mockFetchError(401, "AUTH_SESSION_REQUIRED", "Please sign in to continue.");
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    mockFetchSuccess([{ id: "o-1" }]);

    await expect(getJson("/api/appointments")).resolves.toEqual([{ id: "o-1" }]);

    expect(mockFetch).toHaveBeenNthCalledWith(2, "/api/auth/refresh", { method: "POST" });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("gives up when the refresh is refused, so the caller sees the original failure", async () => {
    mockFetchError(401, "AUTH_SESSION_REQUIRED", "Please sign in to continue.");
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

    await expect(getJson("/api/appointments")).rejects.toMatchObject({ status: 401 });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("survives a refresh that cannot be reached at all", async () => {
    mockFetchError(401, "AUTH_SESSION_REQUIRED", "Please sign in to continue.");
    mockFetch.mockRejectedValueOnce(new TypeError("Network down"));

    await expect(getJson("/api/appointments")).rejects.toBeInstanceOf(ApiError);
  });

  it("refreshes only once for several requests refused together", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === "/api/auth/refresh") return { ok: true, status: 200, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

    await Promise.all([getJson("/api/appointments"), getJson("/api/patients")]);

    const refreshes = mockFetch.mock.calls.filter(([url]) => url === "/api/auth/refresh");
    expect(refreshes).toHaveLength(1);
  });

  it("never tries to refresh the endpoints that establish or end a session", async () => {
    for (const route of [
      "/api/auth/login",
      "/api/auth/logout",
      "/api/auth/confirm",
      "/api/auth/password-reset/complete",
    ]) {
      mockFetch.mockClear();
      mockFetchError(401, "AUTH_SESSION_REQUIRED", "Please sign in to continue.");
      await expect(postJson(route, {})).rejects.toThrow();
      expect(mockFetch, route).toHaveBeenCalledTimes(1);
    }
  });
});

describe("getFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSessionRefresh();
  });

  it("answers with the file itself, sent with no JSON headers", async () => {
    const pdf = new Blob(["%PDF"], { type: "application/pdf" });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, blob: async () => pdf });

    await expect(getFile("/api/bills/b-1/bill.pdf")).resolves.toBe(pdf);
    expect(mockFetch).toHaveBeenCalledWith("/api/bills/b-1/bill.pdf", undefined);
  });

  it("throws the refusal in the server's words, and a bare one in the catalogue's", async () => {
    mockFetchError(404, "RECORD_NOT_FOUND", "That record could not be found.");
    await expect(getFile("/api/bills/b-9/bill.pdf")).rejects.toMatchObject({
      status: 404,
      code: "RECORD_NOT_FOUND",
      message: "That record could not be found.",
    });

    mockFetch.mockResolvedValueOnce({ ok: false, status: 502, json: async () => Promise.reject(new Error("html")) });
    await expect(getFile("/api/bills/b-1/bill.pdf")).rejects.toMatchObject({
      status: 502,
      message: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  });

  it("refreshes an expired session once, as every other call does", async () => {
    mockFetchError(401, "AUTH_SESSION_REQUIRED", "Please sign in to continue.");
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, blob: async () => new Blob(["%PDF"]) });

    await expect(getFile("/api/bills/b-1/bill.pdf")).resolves.toBeInstanceOf(Blob);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
