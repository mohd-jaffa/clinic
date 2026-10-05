// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IMPORT_BATCH_SIZE } from "@/constants/limits";
import type { Tenant } from "@/lib/supabase/tenant";
import type { ImportRowPayload } from "@/lib/validation";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionSafe, getPlatformSettings } = vi.hoisted(() => ({
  logActionSafe: vi.fn(),
  getPlatformSettings: vi.fn(),
}));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe }));
vi.mock("@/lib/platform/settings", () => ({ getPlatformSettings }));

const { findImportMatches, getImportLimits, importPatients } = await import("@/features/patients/import");

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

const row = (key: string, overrides: Partial<ImportRowPayload> = {}): ImportRowPayload => ({
  key,
  fullName: "Rohan Mehta",
  phone: "+919876543210",
  born: { dateOfBirth: "1990-04-03", dobIsEstimated: false },
  gender: "MALE",
  altPhone: null,
  email: null,
  address: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  notes: null,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe("getImportLimits (D128)", () => {
  it("answers the platform's row cap, and how many rows each request sends", async () => {
    getPlatformSettings.mockResolvedValue({ maxImportRows: 25_000 });
    expect(await getImportLimits()).toEqual({ maxRows: 25_000, batchSize: IMPORT_BATCH_SIZE });
  });
});

describe("findImportMatches (plan §10.5)", () => {
  it("reads the clinic's patients on the mobiles asked about, by number", async () => {
    const { tenant, queries, argsOf } = tenantWith({
      answer: () => ({ data: [{ patient_number: 1012, full_name: "Rohan Mehta", phone: "+919876543210" }] }),
    });
    expect(await findImportMatches(tenant, ["+919876543210", "+919811111111"])).toEqual([
      { phone: "+919876543210", number: 1012, name: "Rohan Mehta" },
    ]);
    expect(argsOf(queries[0], "eq")).toEqual([["clinic_id", "clinic-1"]]);
    expect(argsOf(queries[0], "in")).toEqual([["phone", ["+919876543210", "+919811111111"]]]);
    expect(argsOf(queries[0], "order")).toEqual([["patient_number"]]);
  });

  it("answers none when nothing comes back, and the database's refusal in the app's words", async () => {
    expect(await findImportMatches(tenantWith({ answer: () => ({ data: null }) }).tenant, ["+919876543210"])).toEqual(
      [],
    );
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("42501") }) });
    await expect(findImportMatches(tenant, ["+919876543210"])).rejects.toMatchObject({ kind: expect.any(String) });
  });
});

describe("importPatients (plan §10.5, D51)", () => {
  it("sends each row as the database holds a patient, under its own key", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({ data: [{ patient_id: "p-1", patient_number: 1001, created: true }] }),
    });
    await importPatients(tenant, [
      row("k-1", { born: { dateOfBirth: "1992-10-05", dobIsEstimated: true }, notes: "Mornings" }),
    ]);
    expect(rpcs).toEqual([
      {
        name: "import_patients",
        args: {
          p_patients: [
            {
              full_name: "Rohan Mehta",
              phone: "+919876543210",
              date_of_birth: "1992-10-05",
              dob_is_estimated: true,
              gender: "MALE",
              alt_phone: null,
              email: null,
              address: null,
              emergency_contact_name: null,
              emergency_contact_phone: null,
              notes: "Mornings",
              idempotency_key: "k-1",
            },
          ],
        },
      },
    ]);
  });

  it("audits once, for the patients it added — how many and their numbers, never a name", async () => {
    const { tenant } = tenantWith({
      rpc: () => ({
        data: [
          { patient_id: "p-1", patient_number: 1001, created: false },
          { patient_id: "p-2", patient_number: 1004, created: true },
          { patient_id: "p-3", patient_number: 1005, created: true },
        ],
      }),
    });
    expect(await importPatients(tenant, [row("k-1"), row("k-2"), row("k-3")], "req_9")).toEqual({
      imported: 3,
      added: 2,
    });
    expect(logActionSafe).toHaveBeenCalledOnce();
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "CREATE",
      entityType: "patients",
      entityId: null,
      changes: { imported: 2, patient_number: { from: 1004, to: 1005 } },
      requestId: "req_9",
    });
  });

  it("audits nothing for a batch sent again whole, and answers none when nothing comes back", async () => {
    const { tenant } = tenantWith({
      rpc: () => ({ data: [{ patient_id: "p-1", patient_number: 1001, created: false }] }),
    });
    expect(await importPatients(tenant, [row("k-1")])).toEqual({ imported: 1, added: 0 });
    expect(await importPatients(tenantWith({ rpc: () => ({ data: null }) }).tenant, [row("k-1")])).toEqual({
      imported: 0,
      added: 0,
    });
    expect(logActionSafe).not.toHaveBeenCalled();
  });

  it("refuses in the app's words what the database refuses", async () => {
    const { tenant } = tenantWith({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "AUTH_PERMISSION_DENIED" } }),
    });
    await expect(importPatients(tenant, [row("k-1")])).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});
