import { describe, expect, it } from "vitest";

import { ageOn, estimatedBirthDate } from "@/lib/dates/age";

describe("ageOn", () => {
  it("counts whole years, and the months since the last birthday", () => {
    expect(ageOn("1990-03-12", "2026-10-02")).toMatchObject({ years: 36, months: 6 });
    expect(ageOn("1990-10-03", "2026-10-02")).toMatchObject({ years: 35, months: 11 });
    expect(ageOn("1990-10-02", "2026-10-02")).toMatchObject({ years: 36, months: 0 });
  });

  it("counts a newborn's days", () => {
    expect(ageOn("2026-09-20", "2026-10-02")).toEqual({ years: 0, months: 0, days: 12 });
  });

  it("has no age for a date that is not a day, or one still to come", () => {
    expect(ageOn("12/03/1990", "2026-10-02")).toBeNull();
    expect(ageOn("1990-03-12", "today")).toBeNull();
    expect(ageOn("2026-10-03", "2026-10-02")).toBeNull();
  });
});

describe("estimatedBirthDate", () => {
  it("is that many years before today", () => {
    expect(estimatedBirthDate(34, "2026-10-02")).toBe("1992-10-02");
    expect(estimatedBirthDate(0, "2026-10-02")).toBe("2026-10-02");
  });

  it("lands inside a shorter month on a leap day", () => {
    expect(estimatedBirthDate(1, "2028-02-29")).toBe("2027-02-28");
  });
});
