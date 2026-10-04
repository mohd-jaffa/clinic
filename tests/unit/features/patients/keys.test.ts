import { describe, expect, it } from "vitest";

import { patientsKey } from "@/features/patients/keys";

describe("patientsKey (plan §10.2)", () => {
  it("files the list under what was searched and the tab", () => {
    expect(patientsKey("98765", "ALL")).toBe("/api/patients/search?search=98765&tab=ALL");
  });

  it("files the list the page arrives with under the tab alone", () => {
    expect(patientsKey("", "ALL")).toBe("/api/patients/search?tab=ALL");
  });
});
