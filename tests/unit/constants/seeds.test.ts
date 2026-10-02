import { describe, expect, it } from "vitest";

import { APPOINTMENT_MINUTES, TEXT_LIMITS } from "@/constants/limits";
import {
  DEFAULT_APPOINTMENT_TYPES,
  DEFAULT_CLINIC_SETTINGS,
  DEFAULT_CONSULTATION_SERVICE,
  DEFAULT_EXPENSE_CATEGORIES,
} from "@/constants/seeds";
import { FEE_TIMINGS, PAPER_SIZES, SERVICE_CATEGORIES } from "@/constants/statuses";

/** What a new clinic starts with fits what the clinic could have typed itself. */
describe("what a new clinic starts with (plan §5.1)", () => {
  it("has appointment types of different names, each a length a type may have (D32)", () => {
    const names = DEFAULT_APPOINTMENT_TYPES.map(({ name }) => name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const { name, minutes } of DEFAULT_APPOINTMENT_TYPES) {
      expect(name.length, name).toBeLessThanOrEqual(TEXT_LIMITS.catalogueName);
      expect(minutes, name).toBeGreaterThanOrEqual(APPOINTMENT_MINUTES.min);
      expect(minutes, name).toBeLessThanOrEqual(APPOINTMENT_MINUTES.max);
    }
  });

  it("has expense categories of different names (D40)", () => {
    const names = DEFAULT_EXPENSE_CATEGORIES.map((name) => name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const name of DEFAULT_EXPENSE_CATEGORIES) expect(name.length).toBeLessThanOrEqual(TEXT_LIMITS.catalogueName);
  });

  it("has a Consultation on the price list at nothing, for the owner to price", () => {
    expect(DEFAULT_CONSULTATION_SERVICE).toEqual({ name: "Consultation", category: "CONSULTATION", pricePaise: 0 });
    expect(SERVICE_CATEGORIES).toContain(DEFAULT_CONSULTATION_SERVICE.category);
  });

  it("prints on A4 and collects the fee after the consultation", () => {
    expect(DEFAULT_CLINIC_SETTINGS).toEqual({ paperSize: "A4", feeTiming: "AFTER_CONSULTATION" });
    expect(PAPER_SIZES).toContain(DEFAULT_CLINIC_SETTINGS.paperSize);
    expect(FEE_TIMINGS).toContain(DEFAULT_CLINIC_SETTINGS.feeTiming);
  });
});
