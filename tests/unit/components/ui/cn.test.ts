import { describe, expect, it } from "vitest";

import { cn } from "@/components/ui/cn";

describe("cn", () => {
  it("joins the classes that apply", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops the ones that do not", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("is empty when nothing applies", () => {
    expect(cn(false, undefined)).toBe("");
  });
});
