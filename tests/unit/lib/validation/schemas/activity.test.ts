import { describe, expect, it } from "vitest";

import { activityQuerySchema } from "@/lib/validation";

const PERSON = "11111111-1111-4111-8111-111111111111";

describe("activityQuerySchema (plan §19; D388)", () => {
  it("reads a person, a kind and where the page starts; none of them is everything", () => {
    expect(activityQuerySchema.parse({ person: PERSON, kind: "BILLING", cursor: "20" })).toEqual({
      person: PERSON,
      kind: "BILLING",
      cursor: 20,
    });
    expect(activityQuerySchema.parse({})).toEqual({});
  });

  it("refuses a person or a kind it cannot read, in the app's words", () => {
    for (const query of [{ person: "anu" }, { kind: "LEDGERS" }]) {
      const result = activityQuerySchema.safeParse(query);
      expect(result.error?.issues[0].message).toBe("That value is not valid.");
    }
  });
});
