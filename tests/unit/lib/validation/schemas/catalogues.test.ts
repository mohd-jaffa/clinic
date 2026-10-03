import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import {
  appointmentTypeSchema,
  changeAppointmentTypeSchema,
  changeExpenseCategorySchema,
  changeServiceSchema,
  expenseCategorySchema,
  firstIssue,
  serviceSchema,
} from "@/lib/validation";

function messageOf(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : firstIssue(result.error);
}

describe("serviceSchema (plan §9)", () => {
  it("tidies the name and reads the price typed in rupees as paise", () => {
    expect(serviceSchema.parse({ name: "  Root   canal ", category: "PROCEDURE", price: "₹4,500.50" })).toEqual({
      name: "Root canal",
      category: "PROCEDURE",
      price: 450050,
    });
    expect(serviceSchema.parse({ name: "Consultation", category: "CONSULTATION", price: "0" })).toMatchObject({
      price: 0,
    });
  });

  it("says what is wrong with each field, in the catalogue's words", () => {
    const service = { name: "Scaling", category: "PROCEDURE", price: "800" };
    expect(messageOf(serviceSchema, { ...service, name: " " })).toBe(VALIDATION_MESSAGES.required("Service name"));
    expect(messageOf(serviceSchema, { ...service, name: "x".repeat(TEXT_LIMITS.serviceName + 1) })).toBe(
      VALIDATION_MESSAGES.tooLong("Service name", TEXT_LIMITS.serviceName),
    );
    expect(messageOf(serviceSchema, { ...service, category: "" })).toBe(VALIDATION_MESSAGES.choose("Category"));
    expect(messageOf(serviceSchema, { ...service, price: "" })).toBe(VALIDATION_MESSAGES.required("Price"));
    expect(messageOf(serviceSchema, { ...service, price: "-5" })).toBe(VALIDATION_MESSAGES.amount("Price"));
  });
});

describe("appointmentTypeSchema (plan §9, D32)", () => {
  it("tidies the name and reads the minutes as a whole number from 5 to 480", () => {
    expect(appointmentTypeSchema.parse({ name: " Root canal ", minutes: "45" })).toEqual({
      name: "Root canal",
      minutes: 45,
    });
    expect(messageOf(appointmentTypeSchema, { name: "Root canal", minutes: "500" })).toBe(
      VALIDATION_MESSAGES.between("Length in minutes", 5, 480),
    );
    expect(messageOf(appointmentTypeSchema, { name: "x".repeat(TEXT_LIMITS.catalogueName + 1), minutes: "15" })).toBe(
      VALIDATION_MESSAGES.tooLong("Name", TEXT_LIMITS.catalogueName),
    );
  });
});

describe("expenseCategorySchema (plan §9, D40)", () => {
  it("tidies the name, and needs one", () => {
    expect(expenseCategorySchema.parse({ name: "  Lab   fees " })).toEqual({ name: "Lab fees" });
    expect(messageOf(expenseCategorySchema, { name: "" })).toBe(VALIDATION_MESSAGES.required("Name"));
  });
});

describe("a change to one entry (D80)", () => {
  it("is its details, or archiving or restoring it — what is left out stays as it is", () => {
    expect(changeServiceSchema.parse({ active: false })).toEqual({ active: false });
    expect(changeAppointmentTypeSchema.parse({ details: { name: "Review", minutes: "20" } })).toEqual({
      details: { name: "Review", minutes: 20 },
    });
    expect(changeExpenseCategorySchema.parse({})).toEqual({});
    expect(changeExpenseCategorySchema.safeParse({ active: "no" }).success).toBe(false);
  });
});
