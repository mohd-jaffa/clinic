// @vitest-environment node
import { describe, expect, it } from "vitest";

import { listDoctors } from "@/features/team/api";
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
