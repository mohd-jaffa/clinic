import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { ERROR_MESSAGES } from "@/constants/messages";

import { fromPostgrestError, kindOf } from "@/lib/errors/fromSupabaseError";

function postgrest(partial: Partial<PostgrestError>): PostgrestError {
  return { name: "PostgrestError", message: "", details: "", hint: "", code: "", ...partial } as PostgrestError;
}

describe("kindOf", () => {
  it.each([
    ["AUTH_SESSION_REQUIRED", "AUTHENTICATION"],
    ["AUTH_SESSION_INVALID", "AUTHENTICATION"],
    ["AUTH_PERMISSION_DENIED", "AUTHORIZATION"],
    ["NOT_FOUND", "NOT_FOUND"],
    ["RECORD_NOT_FOUND", "NOT_FOUND"],
    ["CONFLICT", "CONFLICT"],
    ["CLOSURE_DAYS_TAKEN", "CONFLICT"],
    ["CLINIC_PLAN_EXPIRED", "BUSINESS_RULE"],
    ["CLOSURE_OVER", "BUSINESS_RULE"],
    ["APPOINTMENT_SLOT_TAKEN", "CONFLICT"],
    ["APPOINTMENT_ON_CLOSED_DAY", "BUSINESS_RULE"],
    ["APPOINTMENT_NOT_TODAY", "BUSINESS_RULE"],
    ["PATIENT_HAS_APPOINTMENTS", "BUSINESS_RULE"],
    ["PRESCRIPTION_NEEDS_REGISTRATION", "BUSINESS_RULE"],
    ["VISIT_CHANGED", "CONFLICT"],
    ["APPOINTMENT_CANCEL_REASON_REQUIRED", "VALIDATION"],
    ["EXTERNAL_SERVICE_ERROR", "EXTERNAL_SERVICE"],
    ["INTERNAL_ERROR", "INTERNAL"],
    ["CONFIG_INVALID", "INTERNAL"],
    ["VALIDATION_ERROR", "VALIDATION"],
  ] as const)("reads %s as %s", (code, kind) => {
    expect(kindOf(code)).toBe(kind);
  });
});

describe("fromPostgrestError", () => {
  it("reads a row-level security refusal as a refusal, not a fault", () => {
    const error = fromPostgrestError(postgrest({ code: "42501", message: "new row violates policy" }));
    expect(error.kind).toBe("AUTHORIZATION");
    expect(error.httpStatus).toBe(403);
  });

  it("reads a duplicate key, or a range overlapping another, as a conflict", () => {
    expect(fromPostgrestError(postgrest({ code: "23505" })).kind).toBe("CONFLICT");
    expect(fromPostgrestError(postgrest({ code: "23P01" })).kind).toBe("CONFLICT");
  });

  it("reads a broken CHECK as a refused value, and an argument a function does not take as invalid", () => {
    expect(fromPostgrestError(postgrest({ code: "23514" }))).toMatchObject({
      code: "VALIDATION_ERROR",
      httpStatus: 422,
    });
    expect(fromPostgrestError(postgrest({ code: "22023" }))).toMatchObject({
      code: "VALIDATION_ERROR",
      httpStatus: 400,
    });
  });

  it("reads a missing single row as not found", () => {
    expect(fromPostgrestError(postgrest({ code: "PGRST116" })).code).toBe("RECORD_NOT_FOUND");
  });

  it("takes the catalogue code a trigger raised in its hint", () => {
    const error = fromPostgrestError(
      postgrest({ code: "P0001", hint: "CLINIC_PLAN_EXPIRED", message: "internal text" }),
    );
    expect(error.code).toBe("CLINIC_PLAN_EXPIRED");
    expect(error.message).toBe(ERROR_MESSAGES.CLINIC_PLAN_EXPIRED);
  });

  it("keeps what a refusal the app raised names in its detail", () => {
    const error = fromPostgrestError(
      postgrest({
        code: "P0001",
        hint: "CLINIC_PLAN_EXPIRED",
        message: "plan expired",
        details: '{"validUntil": "2026-10-01"}',
      }),
    );
    expect(error.httpStatus).toBe(422);
    expect(error.details).toEqual({ validUntil: "2026-10-01" });
  });

  it("keeps no detail that is not the app's own object", () => {
    for (const details of ["", "Key (id)=(1) already exists.", "[1,2]", "null"]) {
      expect(
        fromPostgrestError(postgrest({ code: "P0001", hint: "VALIDATION_ERROR", details })).details,
      ).toBeUndefined();
    }
    expect(fromPostgrestError(postgrest({ code: "23505", details: '{"a":1}' })).details).toBeUndefined();
  });

  it("reads a request that never reached the server as a network failure", () => {
    expect(fromPostgrestError(postgrest({ code: "", message: "TypeError: Failed to fetch" })).kind).toBe("NETWORK");
  });

  it("never lets an unmapped driver message reach the user", () => {
    const error = fromPostgrestError(postgrest({ code: "42703", message: 'column "secret" does not exist' }));
    expect(error.kind).toBe("INTERNAL");
    expect(error.message).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
  });
});

describe("fromPostgrestError, with nothing to go on", () => {
  it("reads a codeless error with no message as internals, not as the network", () => {
    const error = fromPostgrestError(postgrest({ code: "", message: undefined as unknown as string }));
    expect(error.kind).toBe("INTERNAL");
  });
});
