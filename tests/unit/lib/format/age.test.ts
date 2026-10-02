import { afterEach, describe, expect, it, vi } from "vitest";

import { formatAge } from "@/lib/format/age";

afterEach(() => vi.useRealTimers());

describe("formatAge", () => {
  it("shows years for an adult, months for an infant and days for a newborn", () => {
    expect(formatAge("1990-03-12", "2026-10-02")).toBe("36 y");
    expect(formatAge("2026-01-20", "2026-10-02")).toBe("8 mo");
    expect(formatAge("2026-09-20", "2026-10-02")).toBe("12 d");
  });

  it("shows a dash when there is no date to go by", () => {
    expect(formatAge(null, "2026-10-02")).toBe("—");
    expect(formatAge(undefined, "2026-10-02")).toBe("—");
    expect(formatAge("not a date", "2026-10-02")).toBe("—");
  });

  it("goes by the clinic's today when given none", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T05:00:00Z"));
    expect(formatAge("1990-03-12")).toBe("36 y");
  });
});
