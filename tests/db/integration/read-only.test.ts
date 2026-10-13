import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { withAccountRoute, withClinicRoute } from "@/features/auth/guard";
import { getSession } from "@/features/auth/session";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { admin, registerClinic, removeAll, setValidUntil, type TestClinic } from "@tests/support/integration";

/**
 * A clinic whose plan ran out past its grace is view-only (plan §7.3): the
 * route refuses a write with CLINIC_PLAN_EXPIRED, and the database refuses it
 * too — to the owner, holding a valid token, going straight at the API.
 */
let clinic: TestClinic;

const { graceDays, expiryWarningDays } = PLATFORM_SETTING_DEFAULTS;

beforeAll(async () => {
  clinic = await registerClinic();
});

afterAll(removeAll);

const insertService = () =>
  clinic.owner.tenant.supabase
    .from("services")
    .insert({ clinic_id: clinic.clinicId, name: `Item ${Math.random()}`, category: "OTHER", price_paise: 0 });

function request(method: string) {
  return new Request("http://localhost/api/thing", {
    method,
    headers: { authorization: `Bearer ${clinic.owner.session.accessToken}` },
  });
}

describe("each state of the plan (plan §7.2)", () => {
  it("is ACTIVE, EXPIRING, GRACE and READ_ONLY as the days pass, writing in all but the last", async () => {
    const today = todayKey();
    const cases = [
      [addDaysKey(today, expiryWarningDays), "ACTIVE", null],
      [today, "EXPIRING", null],
      [addDaysKey(today, -graceDays), "GRACE", null],
      [addDaysKey(today, -graceDays - 1), "READ_ONLY", "42501"],
    ] as const;
    for (const [validUntil, state, refusal] of cases) {
      await setValidUntil(clinic.clinicId, validUntil);
      const session = await getSession(admin(), clinic.owner.session.accessToken);
      expect(session.subscription!.state, validUntil).toBe(state);
      const { error } = await insertService();
      expect(error?.code ?? null, state).toBe(refusal);
    }
  });
});

describe("a read-only clinic", () => {
  beforeAll(async () => {
    await setValidUntil(clinic.clinicId, addDaysKey(todayKey(), -graceDays - 30));
  });

  it("refuses its owner's write through the database's API, with a valid token", async () => {
    const { error } = await insertService();
    expect(error?.code).toBe("42501");
    const { data } = await clinic.owner.tenant.supabase
      .from("services")
      .update({ price_paise: 5 })
      .eq("clinic_id", clinic.clinicId)
      .select("id");
    expect(data).toEqual([]);
  });

  it("refuses the queue's moves in the database (0018)", async () => {
    const { data: doctor } = await admin()
      .from("doctors")
      .select("id")
      .eq("member_id", clinic.owner.session.membership!.id)
      .single();
    const { error } = await clinic.owner.tenant.supabase.rpc("next_patient", { p_doctor_id: doctor!.id });
    expect(error?.hint).toBe("CLINIC_PLAN_EXPIRED");
  });

  it("refuses a write through a route with CLINIC_PLAN_EXPIRED, and still reads", async () => {
    const write = await withClinicRoute(request("POST"), { access: "settings.manage" }, async () => ({}));
    expect(write.status).toBe(422);
    await expect(write.json()).resolves.toMatchObject({ error: { code: "CLINIC_PLAN_EXPIRED" } });

    const read = await withClinicRoute(request("GET"), { access: "settings.manage" }, async ({ supabase }) => {
      const { data } = await supabase.from("services").select("id");
      return data;
    });
    expect(read.status).toBe(200);
    expect(((await read.json()) as { data: unknown[] }).data.length).toBeGreaterThan(0);
  });

  it("still lets through what the plan keeps open: a route that allows it, a password change", async () => {
    const allowed = await withClinicRoute(request("POST"), { access: "OWNER", allowReadOnly: true }, async () => ({}));
    expect(allowed.status).toBe(200);

    const password = await withAccountRoute(request("POST"), { allowReadOnly: true }, async () => ({}));
    expect(password.status).toBe(200);
    const profile = await withAccountRoute(request("PATCH"), {}, async () => ({}));
    expect(profile.status).toBe(422);
  });
});
