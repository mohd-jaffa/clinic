import { describe, expect, it } from "vitest";

import { activityKey } from "@/features/activity/keys";

describe("activityKey (plan §19)", () => {
  it("names the list and what it is kept to, as the route reads it", () => {
    expect(activityKey(null, null)).toBe("/api/activity");
    expect(activityKey("u-1", "TEAM")).toBe("/api/activity?person=u-1&kind=TEAM");
  });
});
