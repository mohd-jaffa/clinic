import { describe, expect, it } from "vitest";

import { clinicFilterOf, consoleClinicsKey } from "@/features/admin/keys";

describe("the Clinics list's key and filter (plan §20.2)", () => {
  it("asks for what was typed and the filter, and nothing for either left empty", () => {
    expect(consoleClinicsKey("", null)).toBe("/api/admin/clinics");
    expect(consoleClinicsKey("Smile", "NO_TRIAL")).toBe("/api/admin/clinics?search=Smile&filter=NO_TRIAL");
  });

  it("reads a filter an address names, and none for anything else", () => {
    expect(clinicFilterOf("EXPIRING")).toBe("EXPIRING");
    expect(clinicFilterOf("PAID")).toBeNull();
    expect(clinicFilterOf(null)).toBeNull();
    expect(clinicFilterOf(undefined)).toBeNull();
  });
});
