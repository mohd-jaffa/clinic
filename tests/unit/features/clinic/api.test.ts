// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionSafe, warn } = vi.hoisted(() => ({ logActionSafe: vi.fn(), warn: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe }));
vi.mock("@/lib/logger", () => ({ logger: { warn, info: vi.fn(), error: vi.fn() } }));

const { getClinic, readLogo, removeLogo, replaceLogo, toClinicProfile, updateClinic } =
  await import("@/features/clinic/api");

const OLD = "0b6f5a4e-0c2e-4d8b-9f37-1c2d3e4f5a6b";
const NEW = "7d1e2f3a-4b5c-4d6e-8f70-81920a1b2c3d";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const row = (changes: object = {}) => ({
  id: "clinic-1",
  name: "Smile Care",
  clinic_type: "DENTAL",
  phone: null,
  email: null,
  address: "12 MG Road",
  city: "Kochi",
  gstin: null,
  timezone: "Asia/Kolkata",
  paper_size: "A4",
  fee_timing: "AFTER_CONSULTATION",
  logo_path: `clinics/clinic-1/logo/${OLD}`,
  ...changes,
});

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

beforeEach(() => {
  logActionSafe.mockReset();
  warn.mockReset();
  vi.spyOn(crypto, "randomUUID").mockReturnValue(NEW);
});

describe("getClinic", () => {
  it("reads the caller's own clinic, its logo at an address naming its version", async () => {
    const { tenant, find } = tenantWith({ answer: () => ({ data: row({ gstin: "32ABCDE1234F1Z5" }) }) });
    expect(await getClinic(tenant)).toEqual({
      id: "clinic-1",
      name: "Smile Care",
      clinicType: "DENTAL",
      phone: null,
      email: null,
      address: "12 MG Road",
      city: "Kochi",
      gstin: "32ABCDE1234F1Z5",
      timezone: "Asia/Kolkata",
      paperSize: "A4",
      feeTiming: "AFTER_CONSULTATION",
      logoUrl: `/api/clinic/logo?v=${OLD}`,
    });
    expect(find("clinics", "eq", "id", "clinic-1")).toBeDefined();
  });

  it("says when it cannot read it, in the app's words", async () => {
    await expect(
      getClinic(tenantWith({ answer: () => ({ error: postgrestError("42501") }) }).tenant),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    await expect(getClinic(tenantWith({ answer: () => ({ data: null }) }).tenant)).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
  });

  it("has no logo address while there is no logo", () => {
    expect(toClinicProfile(row({ logo_path: null }) as never).logoUrl).toBeNull();
  });
});

describe("updateClinic (D78)", () => {
  const details = {
    name: "Smile Care Dental",
    clinicType: "DENTAL" as const,
    address: "12 MG Road",
    city: "Kochi",
    phone: "0484 234 5678",
    email: null,
    gstin: null,
  };

  it("changes only what it names, through update_clinic_profile, and audits what really changed", async () => {
    const saved = row({ name: "Smile Care Dental", phone: "0484 234 5678", paper_size: "A5" });
    const { tenant, rpcs, rpcChains } = tenantWith({
      answer: () => ({ data: row() }),
      rpc: () => ({ data: saved }),
    });

    const profile = await updateClinic(tenant, { details, paperSize: "A5", feeTiming: "AFTER_CONSULTATION" }, "req_1");

    expect(rpcs).toEqual([
      {
        name: "update_clinic_profile",
        args: {
          p_changes: {
            name: "Smile Care Dental",
            clinic_type: "DENTAL",
            address: "12 MG Road",
            city: "Kochi",
            phone: "0484 234 5678",
            email: null,
            gstin: null,
            paper_size: "A5",
            fee_timing: "AFTER_CONSULTATION",
          },
        },
      },
    ]);
    expect(rpcChains[0][0][0]).toBe("select");
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "UPDATE",
      entityType: "clinics",
      entityId: "clinic-1",
      changes: {
        name: { from: "Smile Care", to: "Smile Care Dental" },
        phone: { from: null, to: "0484 234 5678" },
        paper_size: { from: "A4", to: "A5" },
      },
      requestId: "req_1",
    });
    expect(profile).toMatchObject({ name: "Smile Care Dental", paperSize: "A5" });
  });

  it("writes nothing for nothing named, and audits nothing that did not change", async () => {
    const { tenant, rpcs } = tenantWith({ answer: () => ({ data: row() }), rpc: () => ({ data: row() }) });
    expect(await updateClinic(tenant, {})).toMatchObject({ name: "Smile Care" });
    expect(rpcs).toEqual([]);

    await updateClinic(tenant, { paperSize: "A4" });
    expect(rpcs).toHaveLength(1);
    expect(logActionSafe).not.toHaveBeenCalled();
  });

  it("passes on the database's refusal, in the app's words", async () => {
    const refused = tenantWith({
      answer: () => ({ data: row() }),
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "CLINIC_PLAN_EXPIRED" } }),
    });
    await expect(updateClinic(refused.tenant, { feeTiming: "AT_ARRIVAL" })).rejects.toMatchObject({
      code: "CLINIC_PLAN_EXPIRED",
    });

    const gone = tenantWith({ answer: () => ({ data: row() }), rpc: () => ({ data: null }) });
    await expect(updateClinic(gone.tenant, { feeTiming: "AT_ARRIVAL" })).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
  });
});

describe("replaceLogo (AGENTS.md §20)", () => {
  it("stores the new file, points the clinic at it, and only then removes the old one", async () => {
    let current = row();
    const { tenant, rpcs, storageCalls } = tenantWith({
      answer: () => ({ data: current }),
      rpc: () => {
        current = row({ logo_path: `clinics/clinic-1/logo/${NEW}` });
        return { data: `clinics/clinic-1/logo/${OLD}` };
      },
    });

    const profile = await replaceLogo(tenant, PNG, "req_1");

    expect(storageCalls.map(({ method, bucket, args }) => [method, bucket, args[0]])).toEqual([
      ["upload", "clinic-logos", `clinics/clinic-1/logo/${NEW}`],
      ["remove", "clinic-logos", [`clinics/clinic-1/logo/${OLD}`]],
    ]);
    expect(storageCalls[0].args[2]).toEqual({ contentType: "image/png", upsert: false });
    expect(rpcs).toEqual([{ name: "set_clinic_logo", args: { p_path: `clinics/clinic-1/logo/${NEW}` } }]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "UPDATE",
      entityType: "clinics",
      entityId: "clinic-1",
      changes: { logo: { from: OLD, to: NEW } },
      requestId: "req_1",
    });
    expect(profile.logoUrl).toBe(`/api/clinic/logo?v=${NEW}`);
  });

  it("has nothing to remove when the clinic had no logo", async () => {
    const { tenant, storageCalls } = tenantWith({ answer: () => ({ data: row() }), rpc: () => ({ data: null }) });
    await replaceLogo(tenant, PNG);
    expect(storageCalls.map(({ method }) => method)).toEqual(["upload"]);
    expect(logActionSafe.mock.calls[0][1].changes).toEqual({ logo: { from: null, to: NEW } });
  });

  it("refuses what is not an image by its bytes, before storing anything", async () => {
    const { tenant, storageCalls } = tenantWith({});
    await expect(replaceLogo(tenant, new TextEncoder().encode("GIF89a…"))).rejects.toMatchObject({
      code: "LOGO_TYPE_NOT_ALLOWED",
    });
    expect(storageCalls).toEqual([]);
  });

  it("says so when the file cannot be stored", async () => {
    const { tenant, rpcs } = tenantWith({
      storage: (method) => (method === "upload" ? { error: { message: "bucket said no" } } : {}),
    });
    await expect(replaceLogo(tenant, PNG)).rejects.toMatchObject({ code: "LOGO_UPLOAD_FAILED" });
    expect(rpcs).toEqual([]);
  });

  it("takes the new file away again when the clinic cannot be pointed at it, the old logo kept", async () => {
    const { tenant, storageCalls } = tenantWith({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "AUTH_PERMISSION_DENIED" } }),
    });
    await expect(replaceLogo(tenant, PNG)).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    expect(storageCalls.map(({ method, args }) => [method, args[0]])).toEqual([
      ["upload", `clinics/clinic-1/logo/${NEW}`],
      ["remove", [`clinics/clinic-1/logo/${NEW}`]],
    ]);
    expect(logActionSafe).not.toHaveBeenCalled();
  });

  it("logs a file it could not remove, and carries on", async () => {
    const { tenant } = tenantWith({
      answer: () => ({ data: row() }),
      rpc: () => ({ data: `clinics/clinic-1/logo/${OLD}` }),
      storage: (method) => (method === "remove" ? { error: { message: "still there" } } : {}),
    });
    await replaceLogo(tenant, PNG);
    expect(warn).toHaveBeenCalledWith("Logo file not removed", {
      clinicId: "clinic-1",
      logoId: OLD,
      reason: "still there",
    });
  });
});

describe("removeLogo (D79)", () => {
  it("lets go of the logo first, then removes its file, and audits it", async () => {
    const { tenant, rpcs, storageCalls } = tenantWith({
      answer: () => ({ data: row({ logo_path: null }) }),
      rpc: () => ({ data: `clinics/clinic-1/logo/${OLD}` }),
    });

    expect((await removeLogo(tenant, "req_1")).logoUrl).toBeNull();
    expect(rpcs).toEqual([{ name: "clear_clinic_logo", args: undefined }]);
    expect(storageCalls.map(({ method, args }) => [method, args[0]])).toEqual([
      ["remove", [`clinics/clinic-1/logo/${OLD}`]],
    ]);
    expect(logActionSafe.mock.calls[0][1]).toMatchObject({ changes: { logo: { from: OLD, to: null } } });
  });

  it("does nothing more when there was no logo, and passes on a refusal", async () => {
    const none = tenantWith({ answer: () => ({ data: row({ logo_path: null }) }) });
    await removeLogo(none.tenant);
    expect(none.storageCalls).toEqual([]);
    expect(logActionSafe).not.toHaveBeenCalled();

    const refused = tenantWith({ rpc: () => ({ error: { ...postgrestError("P0001"), hint: "CLINIC_PLAN_EXPIRED" } }) });
    await expect(removeLogo(refused.tenant)).rejects.toMatchObject({ code: "CLINIC_PLAN_EXPIRED" });
  });
});

describe("readLogo", () => {
  it("reads the current file, typed by its own first bytes", async () => {
    const { tenant, storageCalls } = tenantWith({
      answer: () => ({ data: row() }),
      storage: () => ({ data: new Blob([PNG]) }),
    });
    const { file, type } = await readLogo(tenant);
    expect(type).toBe("image/png");
    expect(file.size).toBe(PNG.length);
    expect(storageCalls).toEqual([
      { method: "download", bucket: "clinic-logos", args: [`clinics/clinic-1/logo/${OLD}`] },
    ]);
  });

  it("finds nothing when there is no logo, and says so when the file cannot be read or is not an image", async () => {
    await expect(
      readLogo(tenantWith({ answer: () => ({ data: row({ logo_path: null }) }) }).tenant),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      readLogo(tenantWith({ answer: () => ({ data: row() }), storage: () => ({ error: { message: "gone" } }) }).tenant),
    ).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
    await expect(
      readLogo(tenantWith({ answer: () => ({ data: row() }), storage: () => ({ data: new Blob(["text"]) }) }).tenant),
    ).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
  });
});
