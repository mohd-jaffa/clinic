import { describe, expect, it } from "vitest";

import { treatmentRoutes } from "@/features/treatments/keys";

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
