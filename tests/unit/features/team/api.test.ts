// @vitest-environment node
import { describe, expect, it } from "vitest";

import { findMember, listDoctors, listTeam } from "@/features/team/api";
import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant: Tenant = {
    supabase: fake.client,
    clinicId: "clinic-1",
    actorId: "user-1",
    memberId: "member-1",
    role: "STAFF",
    permissions: [],
    doctorId: null,
  };
  return { ...fake, tenant };
}

const doctor = (id: string, name: string) => ({ id, member: { profile: { full_name: name } } });

describe("listDoctors (plan §30)", () => {
  it("reads the clinic's active doctors of active members, by name", async () => {
    const { tenant, queries, argsOf } = tenantWith({
      answer: () => ({ data: [doctor("d-2", "Rahul Nair"), doctor("d-1", "Asha Menon")] }),
    });
    expect(await listDoctors(tenant)).toEqual([
      { id: "d-1", name: "Asha Menon" },
      { id: "d-2", name: "Rahul Nair" },
    ]);
    expect(queries[0].table).toBe("doctors");
    expect(argsOf(queries[0], "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["active", true],
      ["member.status", "ACTIVE"],
    ]);
  });

  it("answers none as none, and a failure in the app's words", async () => {
    expect(await listDoctors(tenantWith({ answer: () => ({ data: null }) }).tenant)).toEqual([]);
    await expect(
      listDoctors(tenantWith({ answer: () => ({ error: postgrestError("42501") }) }).tenant),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "m-2",
  user_id: "u-2",
  role: "STAFF",
  status: "ACTIVE",
  job_title: "Front desk",
  permissions: ["patients.view"],
  invite_expires_at: null,
  profile: { full_name: "Meera Pillai", email: "meera@example.com" },
  doctors: [],
  ...overrides,
});

describe("listTeam (plan §8.6)", () => {
  it("reads everyone of the clinic, the owner first and then by name, with a doctor's specialization", async () => {
    const { tenant, queries, argsOf } = tenantWith({
      answer: () => ({
        data: [
          row(),
          row({ id: "m-1", user_id: "u-1", role: "OWNER", profile: { full_name: "Zara Owner", email: "z@x.co" } }),
          row({
            id: "m-3",
            role: "DOCTOR",
            status: "INVITED",
            invite_expires_at: "2000-01-01T00:00:00Z",
            profile: { full_name: "Anil Kumar", email: "a@x.co" },
            doctors: { specialization: "Orthodontist" },
          }),
        ],
      }),
    });
    const team = await listTeam(tenant);
    expect(team.map(({ name }) => name)).toEqual(["Zara Owner", "Anil Kumar", "Meera Pillai"]);
    expect(team[1]).toMatchObject({ isDoctor: true, specialization: "Orthodontist", inviteExpired: true });
    expect(team[2]).toEqual({
      id: "m-2",
      userId: "u-2",
      name: "Meera Pillai",
      email: "meera@example.com",
      role: "STAFF",
      status: "ACTIVE",
      jobTitle: "Front desk",
      permissions: ["patients.view"],
      inviteExpiresAt: null,
      inviteExpired: false,
      specialization: null,
      isDoctor: false,
    });
    expect(queries[0].table).toBe("clinic_members");
    expect(argsOf(queries[0], "eq")).toEqual([["clinic_id", "clinic-1"]]);
  });

  it("answers none as none, and a failure in the app's words", async () => {
    expect(await listTeam(tenantWith({ answer: () => ({ data: null }) }).tenant)).toEqual([]);
    await expect(
      listTeam(tenantWith({ answer: () => ({ error: postgrestError("42501") }) }).tenant),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("findMember", () => {
  it("reads one member of the clinic, or says there is none", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: row({ doctors: null }) }) });
    expect(await findMember(tenant, "m-2")).toMatchObject({ id: "m-2", isDoctor: false });
    expect(argsOf(queries[0], "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["id", "m-2"],
    ]);
    await expect(findMember(tenantWith({ answer: () => ({ data: null }) }).tenant, "m-9")).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
    await expect(
      findMember(tenantWith({ answer: () => ({ error: postgrestError("42501") }) }).tenant, "m-9"),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});
