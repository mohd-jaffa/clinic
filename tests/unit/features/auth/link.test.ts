import { afterEach, describe, expect, it } from "vitest";

import { readLinkTokens, takeLinkTokens } from "@/features/auth/link";

afterEach(() => window.history.replaceState(null, "", "/"));

describe("readLinkTokens", () => {
  it("finds the session a link landed with", () => {
    expect(readLinkTokens("#access_token=a-1&refresh_token=r-1&type=recovery")).toEqual({
      tokens: { accessToken: "a-1", refreshToken: "r-1" },
    });
  });

  it("knows a link used twice or too late, and a visit with no link at all", () => {
    expect(readLinkTokens("#error=access_denied&error_code=otp_expired")).toEqual({ tokens: null, expired: true });
    expect(readLinkTokens("#error_code=otp_expired")).toEqual({ tokens: null, expired: true });
    expect(readLinkTokens("#access_token=a-1")).toEqual({ tokens: null, expired: false });
    expect(readLinkTokens("")).toEqual({ tokens: null, expired: false });
  });
});

describe("takeLinkTokens", () => {
  it("reads the tokens and wipes them from the address, keeping where it is", () => {
    window.history.replaceState(null, "", "/reset-password?from=mail#access_token=a-1&refresh_token=r-1");

    expect(takeLinkTokens()).toEqual({ tokens: { accessToken: "a-1", refreshToken: "r-1" } });
    expect(window.location.hash).toBe("");
    expect(window.location.pathname + window.location.search).toBe("/reset-password?from=mail");
  });

  it("leaves an address with no fragment as it is", () => {
    window.history.replaceState(null, "", "/confirm-email");
    const length = window.history.length;
    expect(takeLinkTokens()).toEqual({ tokens: null, expired: false });
    expect(window.location.pathname).toBe("/confirm-email");
    expect(window.history.length).toBe(length);
  });
});
