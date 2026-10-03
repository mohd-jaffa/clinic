import { describe, expect, it } from "vitest";

import { changedValues } from "@/lib/audit/changes";

describe("changedValues", () => {
  it("names each column that really changed, from what to what", () => {
    expect(
      changedValues({ name: "Scaling", price: 800, active: true }, { name: "Scaling", price: 900, active: false }, [
        "name",
        "price",
        "active",
      ]),
    ).toEqual({ price: { from: 800, to: 900 }, active: { from: true, to: false } });
  });

  it("reads a row just made as a change from nothing, and only the columns asked about", () => {
    expect(changedValues(null, { name: "Lab fees", position: 10 }, ["name"])).toEqual({
      name: { from: null, to: "Lab fees" },
    });
  });

  it("is empty when nothing changed", () => {
    expect(changedValues({ name: "Rent" }, { name: "Rent" }, ["name"])).toEqual({});
  });
});
