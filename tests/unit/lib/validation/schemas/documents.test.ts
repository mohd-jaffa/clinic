import { describe, expect, it } from "vitest";

import { VALIDATION_MESSAGES } from "@/constants/messages";
import { documentQuerySchema } from "@/lib/validation";

describe("documentQuerySchema (plan §33, D221)", () => {
  it("opens the document to print unless it is asked to download it", () => {
    expect(documentQuerySchema.parse({})).toEqual({ download: false });
    expect(documentQuerySchema.parse({ download: "1" })).toEqual({ download: true });
  });

  it("refuses anything else asked, in its own words", () => {
    const result = documentQuerySchema.safeParse({ download: "yes" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(VALIDATION_MESSAGES.invalid);
  });
});
