import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import {
  changePasswordSchema,
  confirmEmailSchema,
  emailRequestSchema,
  firstIssue,
  loginSchema,
  passwordResetCompleteSchema,
  registerSchema,
  updateProfileSchema,
} from "@/lib/validation";

function messageOf(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : firstIssue(result.error);
}

const form = {
  fullName: "  Asha   Menon ",
  email: " Asha@Example.com ",
  phone: "098765 43210",
  password: " a secret ",
  clinicName: "Smile​ Care",
  clinicType: "DENTAL",
  city: "Kochi",
  address: "12 MG Road\r\nEdappally",
};

describe("registerSchema (plan §5.1)", () => {
  it("tidies the form: names collapsed, email lower-cased, mobile in E.164, the password untouched", () => {
    expect(registerSchema.parse(form)).toEqual({
      fullName: "Asha Menon",
      email: "asha@example.com",
      phone: "+919876543210",
      password: " a secret ",
      seesPatients: false,
      clinicName: "Smile Care",
      clinicType: "DENTAL",
      city: "Kochi",
      address: "12 MG Road\nEdappally",
      clinicPhone: null,
    });
  });

  it("refuses a clinic type it does not know, and a name too long for its column", () => {
    expect(messageOf(registerSchema, { ...form, clinicType: "VET" })).toBe(VALIDATION_MESSAGES.choose("Clinic type"));
    expect(messageOf(registerSchema, { ...form, clinicName: "a".repeat(TEXT_LIMITS.clinicName + 1) })).toBe(
      VALIDATION_MESSAGES.tooLong("Clinic name", TEXT_LIMITS.clinicName),
    );
    expect(messageOf(registerSchema, { ...form, seesPatients: "yes" })).toBe(VALIDATION_MESSAGES.invalid);
  });
});

describe("loginSchema (D39)", () => {
  it("signs in by an email, lower-cased", () => {
    expect(loginSchema.parse({ identifier: " Asha@Example.com ", password: "p" })).toEqual({
      email: "asha@example.com",
      password: "p",
    });
  });

  it("signs in by a mobile however it was written", () => {
    for (const identifier of ["9876543210", "09876543210", "+91 98765 43210"]) {
      expect(loginSchema.parse({ identifier, password: "p" })).toEqual({ phone: "+919876543210", password: "p" });
    }
  });

  it("refuses what is neither, in one message", () => {
    for (const identifier of ["asha", "asha@", "12345", `${"a".repeat(TEXT_LIMITS.email)}@x.co`]) {
      expect(messageOf(loginSchema, { identifier, password: "p" }), identifier).toBe(
        VALIDATION_MESSAGES.signInIdentifier,
      );
    }
    expect(messageOf(loginSchema, { password: "p" })).toBe(VALIDATION_MESSAGES.signInIdentifier);
  });

  it("asks for a password, but never checks an old one against today's rule", () => {
    expect(messageOf(loginSchema, { identifier: "9876543210", password: "" })).toBe(
      VALIDATION_MESSAGES.required("Password"),
    );
    expect(loginSchema.safeParse({ identifier: "9876543210", password: "short" }).success).toBe(true);
  });
});

describe("the link schemas", () => {
  it("need both of the link's tokens", () => {
    expect(confirmEmailSchema.parse({ accessToken: "a", refreshToken: "r" })).toEqual({
      accessToken: "a",
      refreshToken: "r",
    });
    expect(messageOf(confirmEmailSchema, { accessToken: "a", refreshToken: "" })).toBe(VALIDATION_MESSAGES.invalid);
    expect(messageOf(confirmEmailSchema, { accessToken: "a" })).toBe(VALIDATION_MESSAGES.invalid);
  });

  it("take a new password with the reset link's tokens", () => {
    expect(messageOf(passwordResetCompleteSchema, { accessToken: "a", refreshToken: "r", password: "short" })).toMatch(
      /New password/,
    );
  });
});

describe("emailRequestSchema", () => {
  it("takes an address, tidied", () => {
    expect(emailRequestSchema.parse({ email: " Asha@Example.com" })).toEqual({ email: "asha@example.com" });
    expect(messageOf(emailRequestSchema, { email: "" })).toBe(VALIDATION_MESSAGES.required("Email"));
  });
});

describe("changePasswordSchema (plan §5.4)", () => {
  it("asks for the current password, and a new one that meets the rule", () => {
    expect(changePasswordSchema.parse({ currentPassword: "old", newPassword: "new secret" })).toEqual({
      currentPassword: "old",
      newPassword: "new secret",
    });
    expect(messageOf(changePasswordSchema, { currentPassword: "", newPassword: "new secret" })).toBe(
      VALIDATION_MESSAGES.required("Current password"),
    );
    expect(messageOf(changePasswordSchema, { newPassword: "new secret" })).toBe(
      VALIDATION_MESSAGES.required("Current password"),
    );
  });
});

describe("updateProfileSchema (plan §5.4)", () => {
  it("takes either the name or the mobile, or both, tidied", () => {
    expect(updateProfileSchema.parse({})).toEqual({});
    expect(updateProfileSchema.parse({ fullName: " Asha  M ", phone: "98765 00000" })).toEqual({
      fullName: "Asha M",
      phone: "+919876500000",
    });
  });
});
