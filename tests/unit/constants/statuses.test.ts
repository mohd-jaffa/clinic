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

describe("an appointment's status moves (plan §11.2)", () => {
  const { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_TRANSITIONS } = statuses;

  it("names, for every status, only statuses it may go to — never itself", () => {
    expect(Object.keys(APPOINTMENT_STATUS_TRANSITIONS)).toEqual(expect.arrayContaining([...APPOINTMENT_STATUSES]));
    for (const [from, to] of Object.entries(APPOINTMENT_STATUS_TRANSITIONS)) {
      for (const next of to) expect(APPOINTMENT_STATUSES, `${from} → ${next}`).toContain(next);
      expect(to, from).not.toContain(from);
    }
  });

  it("ends at done and at cancelled, and lets an arrived patient who left be a no-show (D138)", () => {
    expect(APPOINTMENT_STATUS_TRANSITIONS.COMPLETED).toEqual([]);
    expect(APPOINTMENT_STATUS_TRANSITIONS.CANCELLED).toEqual([]);
    expect(APPOINTMENT_STATUS_TRANSITIONS.ARRIVED).toContain("NO_SHOW");
    expect(APPOINTMENT_STATUS_TRANSITIONS.NO_SHOW).toEqual(["ARRIVED"]);
  });

  it("reaches with the doctor only from arrived, and done only from with the doctor", () => {
    const into = (status: string) =>
      Object.entries(APPOINTMENT_STATUS_TRANSITIONS)
        .filter(([, to]) => (to as readonly string[]).includes(status))
        .map(([from]) => from);
    expect(into("IN_PROGRESS")).toEqual(["ARRIVED"]);
    expect(into("COMPLETED")).toEqual(["IN_PROGRESS"]);
  });
});

describe("a treatment's status moves (plan §14.1)", () => {
  const { TREATMENT_STATUSES, TREATMENT_STATUS_TRANSITIONS, OPEN_TREATMENT_STATUSES, TREATMENT_START_STATUSES } =
    statuses;

  it("names, for every status, only statuses it may go to — never itself", () => {
    expect(Object.keys(TREATMENT_STATUS_TRANSITIONS)).toEqual([...TREATMENT_STATUSES]);
    for (const [from, to] of Object.entries(TREATMENT_STATUS_TRANSITIONS)) {
      for (const next of to) expect(TREATMENT_STATUSES, `${from} → ${next}`).toContain(next);
      expect(to, from).not.toContain(from);
    }
  });

  it("ends at completed and at cancelled, completing only what is in progress", () => {
    expect(TREATMENT_STATUS_TRANSITIONS.COMPLETED).toEqual([]);
    expect(TREATMENT_STATUS_TRANSITIONS.CANCELLED).toEqual([]);
    const into = (status: string) =>
      Object.entries(TREATMENT_STATUS_TRANSITIONS)
        .filter(([, to]) => (to as readonly string[]).includes(status))
        .map(([from]) => from);
    expect(into("COMPLETED")).toEqual(["IN_PROGRESS"]);
  });

  it("is open until it may go nowhere, and starts planned or in progress", () => {
    expect(OPEN_TREATMENT_STATUSES).toEqual(
      TREATMENT_STATUSES.filter((status) => TREATMENT_STATUS_TRANSITIONS[status].length > 0),
    );
    expect(TREATMENT_START_STATUSES).toEqual(["PLANNED", "IN_PROGRESS"]);
  });
});
