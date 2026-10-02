import { describe, expect, it } from "vitest";

import * as statuses from "@/constants/statuses";

/** Every vocabulary is a list of distinct upper-case names, and every name a screen shows has its words. */
const vocabularies = Object.entries(statuses).filter(
  ([name, value]) => Array.isArray(value) && !name.endsWith("_LABELS"),
) as [string, readonly string[]][];

describe("the vocabularies the database also knows", () => {
  it("are lists of distinct upper-case names", () => {
    expect(vocabularies.length).toBeGreaterThan(0);
    for (const [name, values] of vocabularies) {
      expect(new Set(values).size, name).toBe(values.length);
      for (const value of values) expect(value, name).toMatch(/^[A-Z0-9_]+$/);
    }
  });

  it("have words for every value a screen shows", () => {
    for (const [name, values] of vocabularies) {
      const labels = (statuses as Record<string, unknown>)[`${name.replace(/S$/, "")}_LABELS`] as
        Record<string, string> | undefined;
      if (!labels) continue;
      expect(Object.keys(labels), name).toEqual([...values]);
      for (const value of values) expect(labels[value], `${name}.${value}`).not.toBe("");
    }
  });

  it("give every status a pill shows a tone", () => {
    for (const [name, values] of vocabularies) {
      const tones = (statuses as Record<string, unknown>)[`${name.replace(/S$/, "")}_TONES`] as
        Record<string, string> | undefined;
      if (!tones) continue;
      expect(Object.keys(tones), name).toEqual([...values]);
    }
    expect(statuses.MEMBER_STATUS_TONES.ACTIVE).toBe("live");
    expect(statuses.SUBSCRIPTION_STATE_TONES.READ_ONLY).toBe("attention");
  });

  it("order a plan's states as the days pass", () => {
    expect(statuses.SUBSCRIPTION_STATES).toEqual(["ACTIVE", "EXPIRING", "GRACE", "READ_ONLY"]);
  });
});
