// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ErrorMessageCode } from "@/constants/messages";
import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionSafe } = vi.hoisted(() => ({ logActionSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe }));

const { tenantRecords } = await import("@/lib/supabase/records");

interface Thing {
  id: string;
  name: string;
  active: boolean;
}

const thing = (changes: Partial<Thing> = {}): Thing => ({ id: "t-1", name: "Rent", active: true, ...changes });

function recordsWith(options: FakeSupabaseOptions, taken?: ErrorMessageCode, named?: readonly string[]) {
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
  return {
    ...fake,
    tenant,
    records: tenantRecords<Thing>(tenant, "things", { columns: "id, name, active", taken, named }),
  };
}

beforeEach(() => logActionSafe.mockReset());

describe("list", () => {
  it("reads the clinic's own rows, in the order asked", async () => {
    const { records, queries, argsOf } = recordsWith({ answer: () => ({ data: [thing()] }) });
    expect(await records.list([{ column: "position" }, { column: "name", ascending: false }])).toEqual([thing()]);
    expect(argsOf(queries[0], "select")).toEqual([["id, name, active"]]);
    expect(argsOf(queries[0], "eq")).toEqual([["clinic_id", "clinic-1"]]);
    expect(argsOf(queries[0], "order")).toEqual([
      ["position", { ascending: true }],
      ["name", { ascending: false }],
    ]);
  });

  it("answers an empty list with none, and a failure in the app's words", async () => {
    expect(await recordsWith({ answer: () => ({ data: null }) }).records.list()).toEqual([]);
    await expect(
      recordsWith({ answer: () => ({ error: postgrestError("42501") }) }).records.list(),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("find", () => {
  it("reads one row of the clinic's by id, or says it is not there", async () => {
    const { records, find } = recordsWith({ answer: () => ({ data: thing() }) });
    expect(await records.find("t-1")).toEqual(thing());
    expect(find("things", "eq", "id", "t-1")).toBeDefined();
    await expect(recordsWith({ answer: () => ({ data: null }) }).records.find("t-9")).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
  });
});

describe("insert", () => {
  it("adds a row to the tenant's clinic and audits what it was made with", async () => {
    const { records, argsOf, queries, tenant } = recordsWith({ answer: () => ({ data: thing({ name: "Lab fees" }) }) });
    expect(await records.insert({ name: "Lab fees" }, { requestId: "req_1" })).toEqual(thing({ name: "Lab fees" }));
    expect(argsOf(queries[0], "insert")).toEqual([[{ name: "Lab fees", clinic_id: "clinic-1" }]]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "CREATE",
      entityType: "things",
      entityId: "t-1",
      changes: { name: { from: null, to: "Lab fees" } },
      requestId: "req_1",
    });
  });

  it("audits a column kept to its name by its name alone (plan §27.6)", async () => {
    const { records, tenant } = recordsWith({ answer: () => ({ data: thing({ name: "Rohan" }) }) }, undefined, [
      "name",
    ]);
    await records.insert({ name: "Rohan", active: true });
    expect(logActionSafe).toHaveBeenCalledWith(
      tenant,
      expect.objectContaining({ changes: { active: { from: null, to: true }, fields: ["name"] } }),
    );
  });

  it("refuses a name already taken in the feature's words, and anything else in the app's", async () => {
    const duplicate = recordsWith(
      { answer: () => ({ error: postgrestError("23505") }) },
      "EXPENSE_CATEGORY_ALREADY_EXISTS",
    );
    await expect(duplicate.records.insert({ name: "Rent" })).rejects.toMatchObject({
      code: "EXPENSE_CATEGORY_ALREADY_EXISTS",
      kind: "CONFLICT",
    });
    await expect(
      recordsWith({ answer: () => ({ error: postgrestError("23505") }) }).records.insert({ name: "Rent" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(logActionSafe).not.toHaveBeenCalled();
  });

  it("refuses days that overlap others in the feature's words too", async () => {
    const overlap = recordsWith({ answer: () => ({ error: postgrestError("23P01") }) }, "CLOSURE_DAYS_TAKEN");
    await expect(overlap.records.insert({ starts_on: "2026-10-20" })).rejects.toMatchObject({
      code: "CLOSURE_DAYS_TAKEN",
      kind: "CONFLICT",
    });
  });
});

describe("update", () => {
  it("writes only the patch, to the clinic's row, and audits what changed under the action named", async () => {
    const { records, queries, argsOf, tenant } = recordsWith({
      answer: (query) => ({
        data: query.calls.some(([method]) => method === "update") ? thing({ active: false }) : thing(),
      }),
    });
    expect(await records.update("t-1", { active: false }, { action: "ARCHIVE", requestId: "req_2" })).toEqual(
      thing({ active: false }),
    );
    const write = queries.find((query) => argsOf(query, "update").length > 0)!;
    expect(argsOf(write, "update")).toEqual([[{ active: false }]]);
    expect(argsOf(write, "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["id", "t-1"],
    ]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "ARCHIVE",
      entityType: "things",
      entityId: "t-1",
      changes: { active: { from: true, to: false } },
      requestId: "req_2",
    });
  });

  it("is an UPDATE by default, and audits nothing when nothing changed", async () => {
    const { records } = recordsWith({ answer: () => ({ data: thing() }) });
    await records.update("t-1", { name: "Rent" });
    expect(logActionSafe).not.toHaveBeenCalled();

    const renamed = recordsWith({
      answer: (query) => ({
        data: query.calls.some(([method]) => method === "update") ? thing({ name: "Lease" }) : thing(),
      }),
    });
    await renamed.records.update("t-1", { name: "Lease" });
    expect(logActionSafe).toHaveBeenCalledWith(renamed.tenant, expect.objectContaining({ action: "UPDATE" }));
  });

  it("writes nothing for an empty patch, and refuses a row it cannot see or a rule the database keeps", async () => {
    const { records, queries } = recordsWith({ answer: () => ({ data: thing() }) });
    expect(await records.update("t-1", {})).toEqual(thing());
    expect(queries).toHaveLength(1);

    await expect(
      recordsWith({ answer: () => ({ data: null }) }).records.update("t-9", { active: false }),
    ).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
    const kept = recordsWith({
      answer: (query) =>
        query.calls.some(([method]) => method === "update")
          ? { error: { ...postgrestError("P0001"), hint: "EXPENSE_CATEGORY_REQUIRED" } }
          : { data: thing() },
    });
    await expect(kept.records.update("t-1", { active: false })).rejects.toMatchObject({
      code: "EXPENSE_CATEGORY_REQUIRED",
      kind: "BUSINESS_RULE",
    });
  });
});
