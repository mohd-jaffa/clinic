// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionSafe } = vi.hoisted(() => ({ logActionSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe }));

const { getMember, setMemberActive, updateMember, updateOwnDoctor } = await import("@/features/team/members");

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant: Tenant = {
    supabase: fake.client,
    clinicId: "clinic-1",
    actorId: "user-0",
    memberId: "member-0",
    role: "OWNER",
    permissions: [],
    doctorId: null,
  };
  return { ...fake, tenant };
}

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "m-2",
  user_id: "u-2",
  role: "DOCTOR",
  status: "ACTIVE",
  job_title: null,
  permissions: ["patients.view"],
  invite_expires_at: null,
  profile: { full_name: "Rahul Nair", email: "rahul@example.com", phone: "+919876501234" },
  doctors: [
    { specialization: "Orthodontist", qualifications: null, registration_number: null, consultation_fee_paise: null },
  ],
  ...overrides,
});

/** Reads answer with `before` until a write has been made, then with `after`. */
function reads(before: object, after: object) {
  let written = false;
  return {
    answer: () => ({ data: written ? after : before }),
    rpc: () => {
      written = true;
      return { data: {} };
    },
  };
}

beforeEach(() => logActionSafe.mockReset());

describe("getMember (plan §8.6)", () => {
  it("reads one member of the clinic, with their mobile and a doctor's details", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: row() }) });
    expect(await getMember(tenant, "m-2")).toMatchObject({
      id: "m-2",
      name: "Rahul Nair",
      phone: "+919876501234",
      specialization: "Orthodontist",
      isDoctor: true,
      doctor: { specialization: "Orthodontist", qualifications: null, registrationNumber: null, feePaise: null },
    });
    expect(argsOf(queries[0], "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["id", "m-2"],
    ]);
  });

  it("reads staff as having no doctor's details, and says there is no one, or why it could not read", async () => {
    const staff = tenantWith({ answer: () => ({ data: row({ role: "STAFF", doctors: null, job_title: "Nurse" }) }) });
    expect(await getMember(staff.tenant, "m-2")).toMatchObject({ doctor: null, isDoctor: false, jobTitle: "Nurse" });
    await expect(getMember(tenantWith({ answer: () => ({ data: null }) }).tenant, "m-9")).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
    await expect(
      getMember(tenantWith({ answer: () => ({ error: postgrestError("42501") }) }).tenant, "m-9"),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("updateMember (D93 – D95)", () => {
  it("sends only what is named, as the database names it, and audits what changed", async () => {
    const after = row({
      permissions: ["patients.view", "patients.create"],
      doctors: {
        specialization: "Orthodontist",
        qualifications: "BDS",
        registration_number: null,
        consultation_fee_paise: 70_000,
      },
    });
    const { tenant, rpcs } = tenantWith(reads(row(), after));
    expect(
      await updateMember(
        tenant,
        "m-2",
        {
          permissions: ["patients.view", "patients.create"],
          doctor: { specialization: "Orthodontist", qualifications: "BDS", registrationNumber: null, fee: 70_000 },
        },
        "req_1",
      ),
    ).toMatchObject({ permissions: ["patients.view", "patients.create"], doctor: { feePaise: 70_000 } });
    expect(rpcs[0]).toEqual({
      name: "update_member",
      args: {
        p_member_id: "m-2",
        p_changes: {
          permissions: ["patients.view", "patients.create"],
          doctor: {
            specialization: "Orthodontist",
            qualifications: "BDS",
            registration_number: null,
            consultation_fee_paise: 70_000,
          },
        },
      },
    });
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "UPDATE",
      entityType: "clinic_members",
      entityId: "m-2",
      changes: {
        permissions: { from: "patients.view", to: "patients.view,patients.create" },
        qualifications: { from: null, to: "BDS" },
        consultation_fee_paise: { from: null, to: 70_000 },
      },
      requestId: "req_1",
    });
  });

  it("sends a job title, cleared too, and audits nothing when nothing changed", async () => {
    const staff = row({ role: "STAFF", doctors: [], job_title: null });
    const { tenant, rpcs } = tenantWith(reads(staff, staff));
    await updateMember(tenant, "m-2", { jobTitle: null });
    expect(rpcs[0].args).toEqual({ p_member_id: "m-2", p_changes: { job_title: null } });
    expect(logActionSafe).not.toHaveBeenCalled();
  });

  it("says why the database refused", async () => {
    const { tenant } = tenantWith({
      answer: () => ({ data: row() }),
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "TEAM_MEMBER_NOT_YOURS" } }),
    });
    await expect(updateMember(tenant, "m-2", { permissions: [] })).rejects.toMatchObject({
      code: "TEAM_MEMBER_NOT_YOURS",
      kind: "BUSINESS_RULE",
    });
  });
});

describe("setMemberActive (plan §8.6)", () => {
  it("deactivates, audited as the status it moved to", async () => {
    const { tenant, rpcs } = tenantWith(reads(row(), row({ status: "INACTIVE" })));
    expect(await setMemberActive(tenant, "m-2", false, "req_2")).toMatchObject({ status: "INACTIVE" });
    expect(rpcs[0]).toEqual({ name: "set_member_active", args: { p_member_id: "m-2", p_active: false } });
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "STATUS_CHANGE",
      entityType: "clinic_members",
      entityId: "m-2",
      changes: { status: { from: "ACTIVE", to: "INACTIVE" } },
      requestId: "req_2",
    });
  });

  it("audits nothing when it already was, and says why the database refused", async () => {
    const same = tenantWith(reads(row(), row()));
    await setMemberActive(same.tenant, "m-2", true);
    expect(logActionSafe).not.toHaveBeenCalled();

    const { tenant } = tenantWith({
      answer: () => ({ data: row() }),
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "TEAM_OWNER_UNCHANGEABLE" } }),
    });
    await expect(setMemberActive(tenant, "m-2", false)).rejects.toMatchObject({ code: "TEAM_OWNER_UNCHANGEABLE" });
  });
});

describe("updateOwnDoctor (plan §3.1, D96, D97)", () => {
  const owner = (active: boolean) =>
    row({
      id: "member-0",
      role: "OWNER",
      doctors: {
        active,
        specialization: null,
        qualifications: null,
        registration_number: null,
        consultation_fee_paise: null,
      },
    });

  it("turns seeing patients off, keeping the profile, and audits it", async () => {
    const { tenant, rpcs, queries, argsOf } = tenantWith(reads(owner(true), owner(false)));
    expect(await updateOwnDoctor(tenant, { seesPatients: false }, "req_3")).toMatchObject({
      seesPatients: false,
      doctor: { specialization: null },
    });
    expect(rpcs).toEqual([{ name: "set_owner_sees_patients", args: { p_sees: false } }]);
    expect(argsOf(queries[0], "eq")).toContainEqual(["id", "member-0"]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "UPDATE",
      entityType: "clinic_members",
      entityId: "member-0",
      changes: { sees_patients: { from: true, to: false } },
      requestId: "req_3",
    });
  });

  it("turns it on and fills it in at once, and says why the database refused", async () => {
    const { tenant, rpcs } = tenantWith(reads(row({ id: "member-0", role: "OWNER", doctors: null }), owner(true)));
    await updateOwnDoctor(tenant, {
      seesPatients: true,
      doctor: { specialization: "Orthodontist", qualifications: null, registrationNumber: "KL-1", fee: null },
    });
    expect(rpcs).toEqual([
      { name: "set_owner_sees_patients", args: { p_sees: true } },
      {
        name: "update_own_doctor",
        args: {
          p_changes: {
            specialization: "Orthodontist",
            qualifications: null,
            registration_number: "KL-1",
            consultation_fee_paise: null,
          },
        },
      },
    ]);

    const off = tenantWith({
      answer: () => ({ data: owner(false) }),
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "OWNER_NOT_DOCTOR" } }),
    });
    await expect(
      updateOwnDoctor(off.tenant, {
        doctor: { specialization: null, qualifications: null, registrationNumber: null, fee: null },
      }),
    ).rejects.toMatchObject({ code: "OWNER_NOT_DOCTOR" });
    const notOwner = tenantWith({
      answer: () => ({ data: owner(true) }),
      rpc: () => ({ error: postgrestError("42501") }),
    });
    await expect(updateOwnDoctor(notOwner.tenant, { seesPatients: true })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});
