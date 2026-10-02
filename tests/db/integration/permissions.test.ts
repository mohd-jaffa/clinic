import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { RouteAccess } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import {
  addMember,
  registerClinic,
  removeAll,
  setMemberStatus,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * The permission matrix, so far (plan §34.3, R1.11): every permission the
 * schema enforces yet, allowed and refused — by the route guard, and by RLS
 * with the member's own token. Each phase adds the rows its tables bring.
 */
let clinic: TestClinic;
let manager: SignedIn & { memberId: string };
let receptionist: SignedIn & { memberId: string };

beforeAll(async () => {
  clinic = await registerClinic();
  [manager, receptionist] = await Promise.all([
    addMember(clinic.clinicId, { permissions: ["settings.manage"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view"] }),
  ]);
});

afterAll(removeAll);

/** A request to a route that serves `access`, as a member's browser sends it. */
async function ask(member: SignedIn, access: RouteAccess, method = "POST") {
  const request = new Request("http://localhost/api/thing", {
    method,
    headers: { authorization: `Bearer ${member.session.accessToken}` },
  });
  const response = await withClinicRoute(request, { access }, async ({ clinicId, role }) => ({ clinicId, role }));
  return { status: response.status, body: await response.json() };
}

describe("by the route guard", () => {
  it("lets a member through to what their permissions allow", async () => {
    await expect(ask(manager, "settings.manage")).resolves.toMatchObject({ status: 200 });
    await expect(ask(receptionist, "appointments.view", "GET")).resolves.toMatchObject({ status: 200 });
  });

  it("refuses what they do not hold, with AUTH_PERMISSION_DENIED", async () => {
    await expect(ask(receptionist, "settings.manage")).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_PERMISSION_DENIED" } },
    });
  });

  it("lets the owner through to everything, owner-only routes included", async () => {
    await expect(ask(clinic.owner, "settings.manage")).resolves.toMatchObject({ status: 200 });
    await expect(ask(clinic.owner, "OWNER")).resolves.toMatchObject({ status: 200 });
    await expect(ask(manager, "OWNER")).resolves.toMatchObject({ status: 403 });
    await expect(ask(receptionist, "MEMBER")).resolves.toMatchObject({ status: 200 });
  });

  it("builds the tenant from the session, never from the request", async () => {
    await expect(ask(receptionist, "MEMBER")).resolves.toMatchObject({
      body: { data: { clinicId: clinic.clinicId, role: "STAFF" } },
    });
  });
});

describe("settings.manage, by RLS", () => {
  const entry = () => ({ name: `Scaling ${Math.random()}`, category: "PROCEDURE", price_paise: 150_000 });

  it("lets a member who holds it add and change the price list, appointment types and expense categories", async () => {
    const { supabase } = manager.tenant!;
    const { data: service, error } = await supabase
      .from("services")
      .insert({ clinic_id: clinic.clinicId, ...entry() })
      .select("id, created_by")
      .single();
    expect(error).toBeNull();
    // Who wrote it is the session's, whatever the client sent (plan §27.4).
    expect(service!.created_by).toBe(manager.userId);

    const { data: changed } = await supabase
      .from("services")
      .update({ price_paise: 1 })
      .eq("id", service!.id)
      .select("id");
    expect(changed).toHaveLength(1);

    const { error: type } = await supabase
      .from("appointment_types")
      .insert({ clinic_id: clinic.clinicId, name: `Scaling ${Math.random()}`, default_minutes: 45 });
    expect(type).toBeNull();
    const { error: category } = await supabase
      .from("expense_categories")
      .insert({ clinic_id: clinic.clinicId, name: `Lab ${Math.random()}` });
    expect(category).toBeNull();
  });

  it("refuses a member who does not hold it", async () => {
    const { supabase } = receptionist.tenant!;
    const { error } = await supabase.from("services").insert({ clinic_id: clinic.clinicId, ...entry() });
    expect(error?.code).toBe("42501");
    const { data: changed } = await supabase
      .from("services")
      .update({ price_paise: 1 })
      .eq("clinic_id", clinic.clinicId)
      .select("id");
    expect(changed).toEqual([]);
    const { error: type } = await supabase
      .from("appointment_types")
      .insert({ clinic_id: clinic.clinicId, name: "Nope", default_minutes: 10 });
    expect(type?.code).toBe("42501");
  });

  it("deletes nothing, for anyone: an entry is archived", async () => {
    const { data } = await clinic.owner.tenant.supabase
      .from("services")
      .delete()
      .eq("clinic_id", clinic.clinicId)
      .select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("the owner's own", () => {
  it("lets only the owner read the plan, its payments and the activity log", async () => {
    for (const table of ["clinic_subscriptions", "audit_logs"]) {
      const { data: owners } = await clinic.owner.tenant.supabase.from(table).select("*");
      expect(owners!.length, table).toBeGreaterThan(0);
      const { data: managers } = await manager.tenant!.supabase.from(table).select("*");
      expect(managers, table).toEqual([]);
    }
  });
});

describe("a deactivated member", () => {
  it("reaches nothing with a token still in hand (plan §8.2 rule 6)", async () => {
    const leaving = await addMember(clinic.clinicId, { permissions: ["settings.manage"] });
    await setMemberStatus(leaving.memberId, "INACTIVE");

    const { data } = await leaving.tenant!.supabase.from("services").select("id");
    expect(data).toEqual([]);
    const { error } = await leaving
      .tenant!.supabase.from("services")
      .insert({ clinic_id: clinic.clinicId, name: "Late", category: "OTHER", price_paise: 0 });
    expect(error?.code).toBe("42501");
    await expect(ask(leaving, "MEMBER", "GET")).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_MEMBERSHIP_INACTIVE" } },
    });
  });
});
