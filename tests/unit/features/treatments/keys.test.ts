import { describe, expect, it } from "vitest";

import { FOLLOW_UP_ROUTES, followUpsKey, treatmentRoutes } from "@/features/treatments/keys";

describe("treatmentRoutes (D256, D260, D262)", () => {
  it("names the patient's summary and history, and the visit when there is one", () => {
    expect(treatmentRoutes("p-1", null)).toEqual(["/api/patients/p-1/summary", "/api/patients/p-1/timeline"]);
    expect(treatmentRoutes("p-1", "v-1")).toEqual([
      "/api/patients/p-1/summary",
      "/api/patients/p-1/timeline",
      "/api/visits/v-1",
    ]);
  });
});

describe("the follow-ups' keys (plan §14.3)", () => {
  it("name a tab by its query, and every tab with their counts as what a contact makes stale", () => {
    expect(followUpsKey("OVERDUE")).toBe("/api/follow-ups?tab=OVERDUE");
    expect(FOLLOW_UP_ROUTES).toEqual(["/api/follow-ups", "/api/follow-ups/counts"]);
  });
});
