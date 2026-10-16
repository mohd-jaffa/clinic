import { randomUUID } from "node:crypto";

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

  it("refuses the queue's moves in the database (0018, 0019)", async () => {
    const { data: doctor } = await admin()
      .from("doctors")
      .select("id")
      .eq("member_id", clinic.owner.session.membership!.id)
      .single();
    const { error } = await clinic.owner.tenant.supabase.rpc("next_patient", { p_doctor_id: doctor!.id });
    expect(error?.hint).toBe("CLINIC_PLAN_EXPIRED");
    const { error: urgent } = await clinic.owner.tenant.supabase.rpc("mark_urgent", {
      p_appointment_id: randomUUID(),
      p_urgent: true,
    });
    expect(urgent?.hint).toBe("CLINIC_PLAN_EXPIRED");
  });

  it("refuses recording into a visit and starting one in the database (0020)", async () => {
    const { supabase } = clinic.owner.tenant;
    for (const [name, args] of [
      ["save_vitals", { p_visit_id: randomUUID(), p_appointment_id: null, p_vitals: { pulse: 70 }, p_seen: null }],
      ["save_vitals", { p_visit_id: null, p_appointment_id: randomUUID(), p_vitals: { pulse: 70 }, p_seen: null }],
      ["update_visit", { p_visit_id: randomUUID(), p_changes: { notes: "Hm" }, p_seen: { notes: null } }],
      ["start_visit", { p_patient_id: randomUUID(), p_doctor_id: randomUUID() }],
      ["finish_visit", { p_visit_id: randomUUID() }],
    ] as const) {
      const { error } = await supabase.rpc(name, args);
      expect(error?.hint, name).toBe("CLINIC_PLAN_EXPIRED");
    }
  });

  it("refuses noting a follow-up call in the database, and still lists the follow-ups (0026)", async () => {
    const { supabase } = clinic.owner.tenant;
    const { error } = await supabase.rpc("record_follow_up_contact", {
      p_contact: { visit_id: randomUUID(), outcome: "REACHED" },
    });
    expect(error?.hint).toBe("CLINIC_PLAN_EXPIRED");
    const { error: unlisted } = await supabase.rpc("follow_up_items", { p_tab: "TODAY", p_offset: 0, p_limit: 20 });
    expect(unlisted).toBeNull();
    const { error: uncounted } = await supabase.rpc("follow_up_counts");
    expect(uncounted).toBeNull();
  });

  it("refuses every bill and payment write in the database, and still reads them (0028, 0029)", async () => {
    const { supabase } = clinic.owner.tenant;
    for (const [name, args] of [
      [
        "create_bill",
        {
          p_bill: { patient_id: randomUUID(), items: [], subtotal_paise: 0, total_paise: 0 },
          p_idempotency_key: randomUUID(),
        },
      ],
      ["void_bill", { p_bill_id: randomUUID(), p_reason: "Wrong patient" }],
      ["mark_no_charge", { p_visit_id: randomUUID(), p_reason: "REVIEW", p_note: null }],
      [
        "record_payment",
        {
          p_payment: { patient_id: randomUUID(), amount_paise: 1_000, method: "CASH" },
          p_idempotency_key: randomUUID(),
        },
      ],
      ["void_payment", { p_payment_id: randomUUID(), p_reason: "Entered twice" }],
    ] as const) {
      const { error } = await supabase.rpc(name, args);
      expect(error?.hint, name).toBe("CLINIC_PLAN_EXPIRED");
    }
    for (const table of ["bills", "bill_items", "payments", "patient_balances", "bill_settlement"]) {
      const { error: unread } = await supabase.from(table).select("clinic_id");
      expect(unread, table).toBeNull();
    }
  });

  it("refuses every treatment write in the database, and still reads them (0024)", async () => {
    const { supabase } = clinic.owner.tenant;
    for (const [name, args] of [
      ["create_treatment", { p_treatment: { name: "Crown", status: "PLANNED" }, p_visit_id: randomUUID() }],
      ["update_treatment", { p_treatment_id: randomUUID(), p_changes: { name: "Crown" }, p_seen: { name: null } }],
      ["change_treatment_status", { p_treatment_id: randomUUID(), p_status: "ON_HOLD", p_seen: "PLANNED" }],
      [
        "record_treatment_session",
        { p_treatment_id: randomUUID(), p_visit_id: randomUUID(), p_note: null, p_seen: null },
      ],
      ["remove_treatment_session", { p_treatment_id: randomUUID(), p_visit_id: randomUUID() }],
    ] as const) {
      const { error } = await supabase.rpc(name, args);
      expect(error?.hint, name).toBe("CLINIC_PLAN_EXPIRED");
    }
    for (const table of ["treatments", "treatment_sessions"]) {
      const { error: unread } = await supabase.from(table).select("id");
      expect(unread, table).toBeNull();
    }
  });

  it("refuses a prescription in the database, and still reads and suggests (0021)", async () => {
    const { supabase } = clinic.owner.tenant;
    const { error } = await supabase.rpc("save_prescription", {
      p_visit_id: randomUUID(),
      p_prescription: { items: [{ medicine: "Paracetamol" }], advice: null, print_diagnosis: false },
      p_seen: null,
    });
    expect(error?.hint).toBe("CLINIC_PLAN_EXPIRED");
    for (const table of ["prescriptions", "prescription_items"]) {
      const { error: unread } = await supabase.from(table).select("id");
      expect(unread, table).toBeNull();
    }
    const { error: unsuggested } = await supabase.rpc("medicine_suggestions", {
      p_search: "Para",
      p_doctor_id: randomUUID(),
    });
    expect(unsuggested).toBeNull();
  });

  it("refuses a template in the database, and still reads them (0023)", async () => {
    const { supabase } = clinic.owner.tenant;
    const { error } = await supabase.rpc("save_prescription_template", {
      p_template_id: null,
      p_template: { name: "Viral fever", items: [{ medicine: "Paracetamol" }], advice: null },
      p_replace: false,
    });
    expect(error?.hint).toBe("CLINIC_PLAN_EXPIRED");
    for (const table of ["prescription_templates", "prescription_template_items"]) {
      const { error: unread } = await supabase.from(table).select("id");
      expect(unread, table).toBeNull();
    }
    // The owner's template, made before the plan ran out, is neither archived nor read as gone.
    const { data: doctor } = await admin()
      .from("doctors")
      .select("id")
      .eq("member_id", clinic.owner.session.membership!.id)
      .single();
    const { data: made } = await admin()
      .from("prescription_templates")
      .insert({ clinic_id: clinic.clinicId, doctor_id: doctor!.id, name: "Kept" })
      .select("id")
      .single();
    const { data: archived } = await supabase
      .from("prescription_templates")
      .update({ active: false })
      .eq("id", made!.id)
      .select("id");
    expect(archived).toEqual([]);
    const { data: kept } = await supabase.from("prescription_templates").select("active").eq("id", made!.id).single();
    expect(kept).toEqual({ active: true });
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
