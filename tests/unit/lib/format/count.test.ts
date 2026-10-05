import { describe, expect, it } from "vitest";

import { formatCount } from "@/lib/format/count";

describe("formatCount", () => {
  it("writes a count as India does", () => {
    expect([0, 999, 1240, 12000, 100000].map(formatCount)).toEqual(["0", "999", "1,240", "12,000", "1,00,000"]);
  });
});
