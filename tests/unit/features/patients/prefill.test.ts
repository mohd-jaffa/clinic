import { describe, expect, it } from "vitest";

import { prefillFrom } from "@/features/patients/prefill";

describe("prefillFrom (D112)", () => {
  it("fills a mobile typed as the mobile, a name as the name, and anything else as nothing", () => {
    expect(prefillFrom("98765 43210")).toEqual({ phone: "98765 43210" });
    expect(prefillFrom("Meera Pillai")).toEqual({ fullName: "Meera Pillai" });
    expect(prefillFrom("P-1012")).toEqual({});
  });
});
