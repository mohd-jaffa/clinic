import { describe, expect, it } from "vitest";

import {
  authenticationError,
  authorizationError,
  businessRuleError,
  conflictError,
  externalServiceError,
  internalError,
  isAppError,
  notFoundError,
  signInRequired,
  toAppError,
  validationError,
} from "@/lib/errors/kinds";

describe("the error factories", () => {
  it.each([
    [validationError(), "VALIDATION", 400],
    [authenticationError(), "AUTHENTICATION", 401],
    [authorizationError(), "AUTHORIZATION", 403],
    [notFoundError(), "NOT_FOUND", 404],
    [conflictError(), "CONFLICT", 409],
    [businessRuleError("VALIDATION_ERROR"), "BUSINESS_RULE", 422],
    [externalServiceError(), "EXTERNAL_SERVICE", 502],
    [internalError(), "INTERNAL", 500],
  ])("gives %#: kind %s and status %i", (error, kind, status) => {
    expect(error.kind).toBe(kind);
    expect(error.httpStatus).toBe(status);
  });

  it("signInRequired asks for a session rather than reporting a fault", () => {
    expect(signInRequired().code).toBe("AUTH_SESSION_REQUIRED");
  });

  it("recognises its own errors and wraps anything else", () => {
    const mine = conflictError();
    expect(isAppError(mine)).toBe(true);
    expect(toAppError(mine)).toBe(mine);

    const wrapped = toAppError("a string nobody expected");
    expect(wrapped.kind).toBe("INTERNAL");
    expect(wrapped.cause).toBe("a string nobody expected");
  });
});
