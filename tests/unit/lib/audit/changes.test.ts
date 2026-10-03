import { describe, expect, it } from "vitest";

import { auditedChanges, changedFields, changedValues } from "@/lib/audit/changes";

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

describe("changedFields", () => {
  it("names the columns that changed, and nothing of their values", () => {
    expect(
      changedFields({ full_name: "Rohan", phone: "+919876543210" }, { full_name: "Rohan M", phone: "+919876543210" }, [
        "full_name",
        "phone",
      ]),
    ).toEqual(["full_name"]);
  });

  it("names, of a row just made, the columns given a value", () => {
    expect(changedFields(null, { full_name: "Rohan", email: null }, ["full_name", "email"])).toEqual(["full_name"]);
  });
});

describe("auditedChanges", () => {
  it("records values, but only the names of the columns kept to their names (plan §27.6)", () => {
    expect(
      auditedChanges(
        { assigned_doctor_id: "d-1", full_name: "Rohan", notes: null },
        { assigned_doctor_id: "d-2", full_name: "Rohan M", notes: "Prefers mornings" },
        ["assigned_doctor_id", "full_name", "notes"],
        ["full_name", "notes"],
      ),
    ).toEqual({ assigned_doctor_id: { from: "d-1", to: "d-2" }, fields: ["full_name", "notes"] });
  });

  it("leaves `fields` out when none of the named changed, and names none by default", () => {
    expect(auditedChanges({ price: 1, name: "A" }, { price: 2, name: "A" }, ["price", "name"], ["name"])).toEqual({
      price: { from: 1, to: 2 },
    });
    expect(auditedChanges(null, { price: 2 }, ["price"])).toEqual({ price: { from: null, to: 2 } });
  });
});
