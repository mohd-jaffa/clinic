import { describe, expect, it } from "vitest";

import {
  PLATFORM_SETTING_BOUNDS,
  PLATFORM_SETTING_COLUMNS,
  PLATFORM_SETTING_DEFAULTS,
  type NumberBound,
} from "@/constants/platform";

describe("the platform settings' defaults (plan §6)", () => {
  it("are the user's own numbers (D11, D12, D14)", () => {
    expect(PLATFORM_SETTING_DEFAULTS).toMatchObject({
      trialDays: 30,
      monthlyPricePaise: 30_000,
      yearlyPricePaise: 300_000,
      expiryWarningDays: 7,
      graceDays: 7,
      auditKeepDays: 30,
      errorLogKeepDays: 7,
    });
  });

  it("are each within their own bounds", () => {
    for (const [key, bound] of Object.entries(PLATFORM_SETTING_BOUNDS) as [string, NumberBound][]) {
      const value = PLATFORM_SETTING_DEFAULTS[key as keyof typeof PLATFORM_SETTING_DEFAULTS];
      const values = Array.isArray(value) ? value : [value as number];
      if (bound.maxCount !== undefined) expect(values.length, key).toBeLessThanOrEqual(bound.maxCount);
      for (const day of values) {
        expect(Number.isInteger(day), key).toBe(true);
        expect(day, key).toBeGreaterThanOrEqual(bound.min);
        expect(day, key).toBeLessThanOrEqual(bound.max);
      }
    }
  });

  it("leave the renewal contact and the business details unset until the DEV sets them", () => {
    for (const key of [
      "renewalContactName",
      "renewalContactPhone",
      "renewalContactEmail",
      "renewalUpiId",
      "businessName",
      "businessAddress",
    ] as const) {
      expect(PLATFORM_SETTING_DEFAULTS[key], key).toBeNull();
    }
  });
});

describe("the platform settings' columns", () => {
  it("name one snake-case column per setting, each once", () => {
    expect(Object.keys(PLATFORM_SETTING_COLUMNS)).toEqual(Object.keys(PLATFORM_SETTING_DEFAULTS));
    const columns = Object.values(PLATFORM_SETTING_COLUMNS);
    expect(new Set(columns).size).toBe(columns.length);
    for (const [key, column] of Object.entries(PLATFORM_SETTING_COLUMNS)) {
      expect(column).toBe(key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`));
    }
  });

  it("bound every number setting", () => {
    const numbers = Object.entries(PLATFORM_SETTING_DEFAULTS)
      .filter(([, value]) => typeof value === "number" || Array.isArray(value))
      .map(([key]) => key);
    expect(Object.keys(PLATFORM_SETTING_BOUNDS)).toEqual(numbers);
  });
});
