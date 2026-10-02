import { describe, expect, it } from "vitest";

import { listParam } from "@/lib/api/params";

describe("listParam", () => {
  it("reads a comma-separated parameter as a list", () => {
    const request = new Request("https://x.test/api/inventory/balance?products=a,b,c");
    expect(listParam(request, "products")).toEqual(["a", "b", "c"]);
  });

  it("trims the values and drops the empty ones", () => {
    const request = new Request("https://x.test/api?products=a, b ,,c,");
    expect(listParam(request, "products")).toEqual(["a", "b", "c"]);
  });

  it("is undefined when the parameter is missing or empty", () => {
    expect(listParam(new Request("https://x.test/api"), "products")).toBeUndefined();
    expect(listParam(new Request("https://x.test/api?products="), "products")).toBeUndefined();
    expect(listParam(new Request("https://x.test/api?products=,,"), "products")).toBeUndefined();
  });
});
