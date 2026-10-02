import { describe, it, expect } from "vitest";
import { buildErrorPayload, errorResponse, successResponse } from "@/lib/api/responses";
import { authenticationError } from "@/lib/errors";
import { redactSensitive } from "@/lib/logger";

describe("API error contract", () => {
  it("returns the standard safe error payload", () => {
    const payload = buildErrorPayload(
      authenticationError("AUTH_SESSION_REQUIRED", {
        password: "should-not-leak",
      }),
      "req_test",
    );

    expect(payload.success).toBe(false);
    if (!payload.success) {
      expect(payload.error.code).toBe("AUTH_SESSION_REQUIRED");
      expect(payload.error.message).toBe("Please sign in to continue.");
      expect(payload.error.requestId).toBe("req_test");
    }
  });

  it("redacts sensitive structured log keys recursively", () => {
    const redacted = redactSensitive({
      phone: "+919876543210",
      password: "secret",
      nested: {
        accessToken: "token",
        service_role_key: "role-key",
      },
    });

    expect(redacted).toEqual({
      phone: "[Redacted]",
      password: "[Redacted]",
      nested: {
        accessToken: "[Redacted]",
        service_role_key: "[Redacted]",
      },
    });
  });

  it("answers so that no browser or proxy keeps the answer, and names its request", () => {
    for (const response of [successResponse({ ok: true }, "req_1"), errorResponse(authenticationError(), "req_2")]) {
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("x-request-id")).toMatch(/^req_/);
    }
  });
});
