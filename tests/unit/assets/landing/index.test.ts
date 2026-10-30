import { describe, expect, it } from "vitest";

import { LANDING_SHOTS } from "@/assets/landing";

describe("LANDING_SHOTS (plan §21; D401)", () => {
  it("has each screen the landing shows, taken in light and in dark", () => {
    expect(Object.keys(LANDING_SHOTS)).toEqual([
      "queue",
      "appointments",
      "visit",
      "followUps",
      "bill",
      "reports",
      "desktop",
    ]);
    for (const shot of Object.values(LANDING_SHOTS)) {
      expect(Object.keys(shot)).toEqual(["light", "dark"]);
      expect(shot.light).not.toEqual(shot.dark);
    }
  });
});
