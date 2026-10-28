import { describe, expect, it } from "vitest";

import { consoleClinicsQuerySchema } from "@/lib/validation";

describe("consoleClinicsQuerySchema (plan §20.2)", () => {
  it("reads what was typed, one filter and where the page starts", () => {
    expect(consoleClinicsQuerySchema.parse({ search: "  Smile  Care ", filter: "NO_TRIAL", cursor: "20" })).toEqual({
      search: "Smile Care",
      filter: "NO_TRIAL",
      cursor: 20,
    });
    expect(consoleClinicsQuerySchema.parse({})).toEqual({ search: null, filter: undefined, cursor: undefined });
  });

  it("refuses a filter it does not know, in the app's words", () => {
    const result = consoleClinicsQuerySchema.safeParse({ filter: "PAID" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("That value is not valid.");
  });
});
