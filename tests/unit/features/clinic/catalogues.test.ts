// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionSafe } = vi.hoisted(() => ({ logActionSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe }));

const { appointmentTypes, expenseCategories, services } = await import("@/features/clinic/catalogues");

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant: Tenant = {
    supabase: fake.client,
    clinicId: "clinic-1",
    actorId: "user-1",
    memberId: "member-1",
    role: "OWNER",
    permissions: [],
    doctorId: null,
  };
  return { ...fake, tenant };
}

/** Answers a write with `after`, and a read with `before`. */
const writes = (before: object, after: object) => (query: { calls: [string, ...unknown[]][] }) => ({
  data: query.calls.some(([method]) => method === "update" || method === "insert") ? after : before,
});

const scaling = { id: "s-1", name: "Scaling", category: "PROCEDURE", price_paise: 80000, active: true };
const consult = { id: "a-1", name: "Consultation", default_minutes: 15, position: 1, active: true };
const rent = { id: "c-1", name: "Rent", position: 1, active: true };

beforeEach(() => logActionSafe.mockReset());

describe("services — the price list (D82)", () => {
  it("lists every service of the clinic by name, archived ones too, as the screen reads them", async () => {
    const { tenant, queries, argsOf } = tenantWith({
      answer: () => ({ data: [scaling, { ...scaling, id: "s-2", active: false }] }),
    });
    expect(await services.list(tenant)).toEqual([
      { id: "s-1", name: "Scaling", category: "PROCEDURE", pricePaise: 80000, active: true },
      { id: "s-2", name: "Scaling", category: "PROCEDURE", pricePaise: 80000, active: false },
    ]);
    expect(queries[0].table).toBe("services");
    expect(argsOf(queries[0], "order")).toEqual([["name", { ascending: true }]]);
  });

  it("adds one, its price in paise, and audits it", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: scaling }) });
    expect(await services.add(tenant, { name: "Scaling", category: "PROCEDURE", price: 80000 }, "req_1")).toMatchObject(
      {
        pricePaise: 80000,
      },
    );
    expect(argsOf(queries[0], "insert")).toEqual([
      [{ name: "Scaling", category: "PROCEDURE", price_paise: 80000, clinic_id: "clinic-1" }],
    ]);
    expect(logActionSafe).toHaveBeenCalledWith(
      tenant,
      expect.objectContaining({ action: "CREATE", requestId: "req_1" }),
    );
  });

  it("says a name another active service has, in its own words", async () => {
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("23505") }) });
    await expect(services.add(tenant, { name: "Scaling", category: "PROCEDURE", price: 0 })).rejects.toMatchObject({
      code: "SERVICE_ALREADY_EXISTS",
    });
  });

  it("changes its details, audited as an update", async () => {
    const { tenant } = tenantWith({ answer: writes(scaling, { ...scaling, price_paise: 90000 }) });
    expect(
      await services.change(
        tenant,
        "s-1",
        { details: { name: "Scaling", category: "PROCEDURE", price: 90000 } },
        "req_2",
      ),
    ).toMatchObject({ pricePaise: 90000 });
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "UPDATE",
      entityType: "services",
      entityId: "s-1",
      changes: { price_paise: { from: 80000, to: 90000 } },
      requestId: "req_2",
    });
  });

  it("archives and restores, audited as that (D80)", async () => {
    const archived = tenantWith({ answer: writes(scaling, { ...scaling, active: false }) });
    expect(await services.change(archived.tenant, "s-1", { active: false })).toMatchObject({ active: false });
    expect(logActionSafe).toHaveBeenLastCalledWith(archived.tenant, expect.objectContaining({ action: "ARCHIVE" }));

    const restored = tenantWith({ answer: writes({ ...scaling, active: false }, scaling) });
    expect(await services.change(restored.tenant, "s-1", { active: true })).toMatchObject({ active: true });
    expect(logActionSafe).toHaveBeenLastCalledWith(restored.tenant, expect.objectContaining({ action: "RESTORE" }));
  });

  it("changes nothing for an empty change", async () => {
    const { tenant, queries } = tenantWith({ answer: () => ({ data: scaling }) });
    expect(await services.change(tenant, "s-1", {})).toMatchObject({ id: "s-1" });
    expect(queries).toHaveLength(1);
  });

  it("passes on the database's refusal to archive the last Consultation (D83)", async () => {
    const { tenant } = tenantWith({
      answer: (query) =>
        query.calls.some(([method]) => method === "update")
          ? { error: { ...postgrestError("P0001"), hint: "CONSULTATION_SERVICE_REQUIRED" } }
          : { data: { ...scaling, category: "CONSULTATION" } },
    });
    await expect(services.change(tenant, "s-1", { active: false })).rejects.toMatchObject({
      code: "CONSULTATION_SERVICE_REQUIRED",
    });
  });
});

describe("appointment types (D32, D81)", () => {
  it("lists them in the clinic's order, each with its usual length", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: [consult] }) });
    expect(await appointmentTypes.list(tenant)).toEqual([
      { id: "a-1", name: "Consultation", minutes: 15, active: true },
    ]);
    expect(queries[0].table).toBe("appointment_types");
    expect(argsOf(queries[0], "order")).toEqual([
      ["position", { ascending: true }],
      ["name", { ascending: true }],
    ]);
  });

  it("adds one with no position of its own — the database puts it last — and changes one", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: { ...consult, name: "Root canal" } }) });
    await appointmentTypes.add(tenant, { name: "Root canal", minutes: 45 });
    expect(argsOf(queries[0], "insert")).toEqual([
      [{ name: "Root canal", default_minutes: 45, clinic_id: "clinic-1" }],
    ]);

    const changed = tenantWith({ answer: writes(consult, { ...consult, default_minutes: 20 }) });
    expect(
      await appointmentTypes.change(changed.tenant, "a-1", { details: { name: "Consultation", minutes: 20 } }),
    ).toMatchObject({
      minutes: 20,
    });
  });

  it("says a name another active type has, in its own words", async () => {
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("23505") }) });
    await expect(appointmentTypes.add(tenant, { name: "Review", minutes: 15 })).rejects.toMatchObject({
      code: "APPOINTMENT_TYPE_ALREADY_EXISTS",
    });
  });
});

describe("expense categories (D40, D81)", () => {
  it("lists them in the clinic's order, adds and renames one", async () => {
    const listed = tenantWith({ answer: () => ({ data: [rent] }) });
    expect(await expenseCategories.list(listed.tenant)).toEqual([{ id: "c-1", name: "Rent", active: true }]);
    expect(listed.queries[0].table).toBe("expense_categories");

    const added = tenantWith({ answer: () => ({ data: { ...rent, name: "Lab fees" } }) });
    await expenseCategories.add(added.tenant, { name: "Lab fees" });
    expect(added.argsOf(added.queries[0], "insert")).toEqual([[{ name: "Lab fees", clinic_id: "clinic-1" }]]);

    const renamed = tenantWith({ answer: writes(rent, { ...rent, name: "Lease" }) });
    expect(await expenseCategories.change(renamed.tenant, "c-1", { details: { name: "Lease" } })).toMatchObject({
      name: "Lease",
    });
  });

  it("says a name another active category has, in its own words", async () => {
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("23505") }) });
    await expect(expenseCategories.add(tenant, { name: "Rent" })).rejects.toMatchObject({
      code: "EXPENSE_CATEGORY_ALREADY_EXISTS",
    });
  });
});
