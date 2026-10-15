import { describe, expect, it } from "vitest";

import { templatesKey } from "@/features/prescriptions/keys";

describe("templatesKey (D241, D242)", () => {
  it("asks for one doctor's templates", () => {
    expect(templatesKey("d-1")).toBe("/api/prescription-templates?doctorId=d-1");
  });
});
