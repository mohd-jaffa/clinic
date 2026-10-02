import { describe, expect, it } from "vitest";

import { mobileHmac } from "@/features/auth/trial";

const SECRET = "a-secret-of-at-least-thirty-two-characters";

describe("mobileHmac (D42)", () => {
  it("gives one mobile the same value every time, as hex the claim's CHECK takes", () => {
    const value = mobileHmac("+919876543210", SECRET);
    expect(value).toMatch(/^[0-9a-f]{64}$/);
    expect(mobileHmac("+919876543210", SECRET)).toBe(value);
  });

  it("never gives the number back, and differs by number and by key", () => {
    const value = mobileHmac("+919876543210", SECRET);
    expect(value).not.toContain("9876543210");
    expect(mobileHmac("+919876543211", SECRET)).not.toBe(value);
    expect(mobileHmac("+919876543210", `${SECRET}!`)).not.toBe(value);
  });
});
