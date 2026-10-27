import { describe, expect, it } from "vitest";

import { greetingOf } from "@/features/dashboard/greeting";

describe("greetingOf (plan §17)", () => {
  it("greets by the clinic's clock: morning until noon, afternoon until five, then evening", () => {
    expect(greetingOf("Asha Menon", false, 0)).toBe("Good morning, Asha");
    expect(greetingOf("Asha Menon", false, 11)).toBe("Good morning, Asha");
    expect(greetingOf("Asha Menon", false, 12)).toBe("Good afternoon, Asha");
    expect(greetingOf("Asha Menon", false, 16)).toBe("Good afternoon, Asha");
    expect(greetingOf("Asha Menon", false, 17)).toBe("Good evening, Asha");
    expect(greetingOf("Asha Menon", false, 23)).toBe("Good evening, Asha");
  });

  it("greets a doctor as Dr. and their first name — the one after Dr. when their name starts with it", () => {
    expect(greetingOf("  Rahul   Sharma ", true, 9)).toBe("Good morning, Dr. Rahul");
    expect(greetingOf("Dr. Rahul Sharma", true, 9)).toBe("Good morning, Dr. Rahul");
    expect(greetingOf("dr Rahul", false, 9)).toBe("Good morning, Dr. Rahul");
    expect(greetingOf("Dr.", false, 9)).toBe("Good morning, Dr. ");
  });

  it("still greets before the name is known", () => {
    expect(greetingOf("", false, 9)).toBe("Good morning, ");
  });
});
