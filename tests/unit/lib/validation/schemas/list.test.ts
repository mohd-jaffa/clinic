import { describe, expect, it } from "vitest";

import { MAX_SEARCH_LENGTH } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import { firstIssue, listQuerySchema } from "@/lib/validation";

describe("listQuerySchema", () => {
  it("starts at the beginning with no search", () => {
    expect(listQuerySchema.parse({})).toEqual({ cursor: undefined, search: null });
  });

  it("reads the cursor as the row a page starts at, and tidies the search", () => {
    expect(listQuerySchema.parse({ cursor: "40", search: "  Anu   Sharma " })).toEqual({
      cursor: 40,
      search: "Anu Sharma",
    });
  });

  it("refuses a cursor that is not a place in a list", () => {
    for (const cursor of ["-1", "abc", "1.5", "1000000", "200000"]) {
      const result = listQuerySchema.safeParse({ cursor });
      expect(result.success).toBe(false);
      if (!result.success) expect(firstIssue(result.error)).toBe(VALIDATION_MESSAGES.invalid);
    }
  });

  it("bounds the search", () => {
    const result = listQuerySchema.safeParse({ search: "a".repeat(MAX_SEARCH_LENGTH + 1) });
    expect(result.success).toBe(false);
  });
});
