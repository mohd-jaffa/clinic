import { afterEach, describe, expect, it } from "vitest";

import { takeInviteToken } from "@/features/team/link";

afterEach(() => window.history.replaceState(null, "", "/"));

describe("takeInviteToken (D63)", () => {
  it("takes the token from the address's fragment and wipes it from the address", () => {
    window.history.replaceState(null, "", "/accept-invite?from=mail#token=abc_DEF-123");
    expect(takeInviteToken()).toBe("abc_DEF-123");
    expect(window.location.href).toMatch(/\/accept-invite\?from=mail$/);
  });

  it("finds none in an address without one", () => {
    window.history.replaceState(null, "", "/accept-invite");
    expect(takeInviteToken()).toBeNull();
    expect(window.location.pathname).toBe("/accept-invite");
  });
});
