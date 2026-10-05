import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addClosure } from "@/features/clinic/closures";
import { todayKey } from "@/lib/dates/calendar";
import { getServerEnv } from "@/lib/env/server";
import {
  addMember,
  admin,
  makeDeveloper,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Clinic A's records are never clinic B's (plan §27, AGENTS.md §7). B's owner
 * holds a valid token and goes straight at the database's API, as anyone with
 * that token could: nothing of A's is there to read or to change. Every
 * clinic-owned table has a row here (AGENTS.md §7).
 */
const CLINIC_TABLES: readonly { table: string; column: string }[] = [
  { table: "clinics", column: "id" },
  { table: "clinic_members", column: "clinic_id" },
  { table: "doctors", column: "clinic_id" },
  { table: "clinic_subscriptions", column: "clinic_id" },
  { table: "subscription_payments", column: "clinic_id" },
  { table: "services", column: "clinic_id" },
  { table: "appointment_types", column: "clinic_id" },
  { table: "expense_categories", column: "clinic_id" },
  { table: "clinic_closures", column: "clinic_id" },
  { table: "patients", column: "clinic_id" },
  { table: "patient_alerts", column: "clinic_id" },
  { table: "audit_logs", column: "clinic_id" },
];

/** A clinic's tables only the database itself reads and writes: the patient counter, the doctor scope (0015). */
const DATABASE_TABLES = ["patient_counters", "patient_doctors"];

/** The platform's own tables: no signed-in member, nor the DEV's own token, reads them. */
const PLATFORM_TABLES = ["platform_settings", "trial_claims", "receipt_counters", "error_logs"];

let a: TestClinic;
let b: TestClinic;
let developer: SignedIn;
/** A's patient, which B's owner goes looking for. */
let patientId: string;

beforeAll(async () => {
  [a, b] = await Promise.all([registerClinic({ clinicName: "Clinic A" }), registerClinic({ clinicName: "Clinic B" })]);
  await addMember(a.clinicId, { role: "DOCTOR", permissions: ["patients.view"] });
  await addClosure(a.owner.tenant, { doctorId: null, startsOn: todayKey(), endsOn: todayKey(), reason: "Holiday" });
  const { data: patient, error } = await a.owner.tenant.supabase
    .rpc("create_patient", {
      p_patient: { full_name: "Rohan Mehta", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  patientId = patient.patient_id;
  await a.owner.tenant.supabase
    .from("patient_alerts")
    .insert({ clinic_id: a.clinicId, patient_id: patientId, kind: "ALLERGY", label: "Penicillin" });
  developer = await makeDeveloper();
});

afterAll(removeAll);

describe("as clinic B's owner, with a valid token", () => {
  it("reads none of A's rows, in any table that belongs to a clinic", async () => {
    for (const { table, column } of CLINIC_TABLES) {
      const { data, error } = await b.owner.tenant.supabase.from(table).select("*").eq(column, a.clinicId);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it("reads none of A's people", async () => {
    const { data } = await b.owner.tenant.supabase.from("profiles").select("id").eq("id", a.owner.userId);
    expect(data).toEqual([]);
  });

  it("reads its own clinic, and A's owner reads A's", async () => {
    for (const { table, column } of CLINIC_TABLES.filter(({ table }) => table !== "subscription_payments")) {
      const { data } = await a.owner.tenant.supabase.from(table).select("*").eq(column, a.clinicId);
      expect(data!.length, table).toBeGreaterThan(0);
    }
  });

  it("writes nothing into A's clinic", async () => {
    const { error: insert } = await b.owner.tenant.supabase
      .from("services")
      .insert({ clinic_id: a.clinicId, name: "Planted", category: "OTHER", price_paise: 100 });
    expect(insert?.code).toBe("42501");

    const { data: updated } = await b.owner.tenant.supabase
      .from("services")
      .update({ price_paise: 1 })
      .eq("clinic_id", a.clinicId)
      .select("id");
    expect(updated).toEqual([]);

    const { data: renamed } = await b.owner.tenant.supabase
      .from("patients")
      .update({ full_name: "Planted" })
      .eq("clinic_id", a.clinicId)
      .select("id");
    expect(renamed).toEqual([]);

    const { data: moved } = await b.owner.tenant.supabase
      .from("services")
      .update({ clinic_id: a.clinicId })
      .eq("clinic_id", b.clinicId)
      .select("id");
    expect(moved ?? []).toEqual([]);
  });

  it("finds none of A's patients, and writes nothing onto one", async () => {
    const { supabase } = b.owner.tenant;
    const { data: found } = await supabase.rpc("search_patients", {
      p_words: "Rohan",
      p_digits: "9876543210",
      p_number: null,
      p_archived: false,
      p_offset: 0,
      p_limit: 20,
    });
    expect(found).toEqual([]);
    const { data: seen } = await supabase.rpc("can_see_patient", { p_patient_id: patientId });
    expect(seen).toBe(false);

    const { error: planted } = await supabase
      .from("patient_alerts")
      .insert({ clinic_id: a.clinicId, patient_id: patientId, kind: "ALLERGY", label: "Planted" });
    expect(planted?.code).toBe("42501");
    const { error: crossed } = await supabase
      .from("patient_alerts")
      .insert({ clinic_id: b.clinicId, patient_id: patientId, kind: "ALLERGY", label: "Crossed" });
    // Its own clinic named, the patient is still not its own: the composite key refuses it.
    expect(crossed?.code).toBe("23503");
    const { data: archived } = await supabase
      .from("patients")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", patientId)
      .select("id");
    expect(archived).toEqual([]);
  });

  it("reaches none of the platform's tables, nor those only the database reads", async () => {
    for (const table of [...PLATFORM_TABLES, ...DATABASE_TABLES]) {
      const { error } = await b.owner.tenant.supabase.from(table).select("*").limit(1);
      expect(error?.code, table).toBe("42501");
    }
  });

  it("calls none of the server's or the admin's functions", async () => {
    const { error: registered } = await b.owner.tenant.supabase.rpc("register_clinic", {
      p_user_id: b.owner.userId,
      p_full_name: "x",
      p_email: "x@y.co",
      p_phone: null,
      p_sees_patients: false,
      p_clinic_name: "x",
      p_clinic_type: "OTHER",
      p_city: "x",
      p_address: "x",
      p_clinic_phone: null,
      p_mobile_hmac: "0".repeat(64),
    });
    expect(registered?.code).toBe("42501");

    const { error: cleaned } = await b.owner.tenant.supabase.rpc("clean_up_logs");
    expect(cleaned?.code).toBe("42501");

    const { error: extended } = await b.owner.tenant.supabase.rpc("extend_clinic_subscription", {
      p_clinic_id: b.clinicId,
      p_kind: "YEARLY",
      p_amount_paise: 0,
      p_method: null,
      p_reference: null,
      p_paid_on: null,
      p_valid_until: null,
      p_reason: null,
    });
    expect(extended?.code).toBe("42501");

    const { error: settings } = await b.owner.tenant.supabase.rpc("update_platform_settings", {
      p_changes: { grace_days: 60 },
    });
    expect(settings?.code).toBe("42501");
  });
});

describe("as the platform admin (DEV)", () => {
  it("reads no clinic's rows with their own token (plan §20)", async () => {
    const supabase = createClient(
      getServerEnv().NEXT_PUBLIC_SUPABASE_URL,
      getServerEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${developer.session.accessToken}` } },
      },
    );
    for (const { table } of CLINIC_TABLES) {
      const { data } = await supabase.from(table).select("*").limit(5);
      expect(data, table).toEqual([]);
    }
  });

  it("belongs to no clinic: a membership for them is refused, and a member is never made DEV", async () => {
    const { error } = await admin().from("clinic_members").insert({
      clinic_id: a.clinicId,
      user_id: developer.userId,
      role: "STAFF",
      status: "ACTIVE",
      joined_at: "now()",
    });
    expect(error?.code).toBe("23514");

    const { error: promoted } = await admin()
      .from("profiles")
      .update({ platform_role: "DEV" })
      .eq("id", b.owner.userId);
    expect(promoted?.code).toBe("23514");
  });
});

describe("signed out, with only the public key", () => {
  it("reads and writes nothing at all", async () => {
    const env = getServerEnv();
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    for (const table of [
      ...CLINIC_TABLES.map(({ table }) => table),
      "profiles",
      ...PLATFORM_TABLES,
      ...DATABASE_TABLES,
    ]) {
      const { error } = await anon.from(table).select("*").limit(1);
      expect(error?.code, table).toBe("42501");
    }
    const { error } = await anon.rpc("current_clinic_id");
    expect(error?.code).toBe("42501");
  });
});
