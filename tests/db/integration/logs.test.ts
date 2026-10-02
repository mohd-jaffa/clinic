import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { captureError } from "@/lib/audit/errorLog";
import { logActionSafe } from "@/lib/audit/auditLog";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platform/settings";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import {
  admin,
  makeDeveloper,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * The audit trail and the error log (plan §19, §36; R1.6): written by the
 * server only, read by whom they belong to, and purged by the retention the
 * DEV sets.
 */
let clinic: TestClinic;
let developer: SignedIn;
let keepDays: { auditKeepDays: number; errorLogKeepDays: number };

beforeAll(async () => {
  clinic = await registerClinic();
  developer = await makeDeveloper();
  const { auditKeepDays, errorLogKeepDays } = await getPlatformSettings();
  keepDays = { auditKeepDays, errorLogKeepDays };
});

afterAll(async () => {
  await updatePlatformSettings(createSupabaseAnonClient(developer.session.accessToken), keepDays, "req_restore");
  await removeAll();
});

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

describe("the audit trail", () => {
  it("is written by the server with the tenant's clinic and actor, and read by the owner", async () => {
    const requestId = `req_${randomUUID()}`;
    await logActionSafe(clinic.owner.tenant, {
      action: "UPDATE",
      entityType: "services",
      entityId: randomUUID(),
      changes: { price_paise: { from: 0, to: 50_000 } },
      requestId,
    });
    const { data } = await clinic.owner.tenant.supabase
      .from("audit_logs")
      .select("*")
      .eq("request_id", requestId)
      .single();
    expect(data).toMatchObject({ clinic_id: clinic.clinicId, actor_id: clinic.owner.userId, action: "UPDATE" });
  });

  it("cannot be written, changed or deleted by a member", async () => {
    const { supabase } = clinic.owner.tenant;
    const { error } = await supabase
      .from("audit_logs")
      .insert({ clinic_id: clinic.clinicId, action: "CREATE", entity_type: "services" });
    expect(error?.code).toBe("42501");
    const { error: changed } = await supabase
      .from("audit_logs")
      .update({ action: "VOID" })
      .eq("clinic_id", clinic.clinicId);
    expect(changed?.code).toBe("42501");
    const { error: deleted } = await supabase.from("audit_logs").delete().eq("clinic_id", clinic.clinicId);
    expect(deleted?.code).toBe("42501");
  });

  it("logs a failed write to the error log instead of failing", async () => {
    const reference = `req_${randomUUID()}`;
    await expect(
      logActionSafe(clinic.owner.tenant, {
        action: "CREATE",
        entityType: "Not a table!",
        entityId: null,
        requestId: reference,
      }),
    ).resolves.toBeUndefined();
    const { data } = await admin().from("error_logs").select("message, clinic_id").eq("reference", reference).single();
    expect(data).toEqual({ message: "Failed to write audit log", clinic_id: clinic.clinicId });
  });
});

describe("the error log", () => {
  it("keeps the failure with its reference, its context redacted of patient details", async () => {
    const reference = `req_${randomUUID()}`;
    await captureError({
      message: "Something broke",
      error: new Error("driver said no"),
      reference,
      httpStatus: 500,
      path: "/api/patients",
      clinicId: clinic.clinicId,
      context: { patientName: "Anu Thomas", phone: "+919876543210", diagnosis: "Caries", count: 3 },
    });
    const { data } = await admin().from("error_logs").select("*").eq("reference", reference).single();
    expect(data).toMatchObject({
      source: "SERVER",
      message: "Something broke",
      detail: "driver said no",
      http_status: 500,
    });
    expect(JSON.stringify(data!.context)).not.toMatch(/Anu|9876543210|Caries/);
    expect(data!.context).toMatchObject({ count: 3 });
  });
});

describe("the purge (clean_up_logs)", () => {
  it("drops rows older than the retention the DEV set, and keeps the rest", async () => {
    const tag = randomUUID();
    await admin()
      .from("audit_logs")
      .insert([
        {
          clinic_id: clinic.clinicId,
          action: "CREATE",
          entity_type: "services",
          request_id: `old-${tag}`,
          created_at: daysAgo(40),
        },
        {
          clinic_id: clinic.clinicId,
          action: "CREATE",
          entity_type: "services",
          request_id: `new-${tag}`,
          created_at: daysAgo(20),
        },
      ]);
    await admin()
      .from("error_logs")
      .insert([
        { source: "SERVER", message: "old", reference: `old-${tag}`, created_at: daysAgo(8) },
        { source: "SERVER", message: "new", reference: `new-${tag}`, created_at: daysAgo(2) },
      ]);

    await updatePlatformSettings(
      createSupabaseAnonClient(developer.session.accessToken),
      { auditKeepDays: 30, errorLogKeepDays: 7 },
      "req_retention",
    );
    const { data: dropped, error } = await admin().rpc("clean_up_logs");
    expect(error).toBeNull();
    expect(dropped).toBeGreaterThanOrEqual(2);

    const audit = await admin()
      .from("audit_logs")
      .select("request_id")
      .in("request_id", [`old-${tag}`, `new-${tag}`]);
    expect(audit.data).toEqual([{ request_id: `new-${tag}` }]);
    const errors = await admin()
      .from("error_logs")
      .select("reference")
      .in("reference", [`old-${tag}`, `new-${tag}`]);
    expect(errors.data).toEqual([{ reference: `new-${tag}` }]);

    // A shorter retention takes the rest at the next purge.
    await updatePlatformSettings(
      createSupabaseAnonClient(developer.session.accessToken),
      { auditKeepDays: 7, errorLogKeepDays: 1 },
      "req_retention",
    );
    await admin().rpc("clean_up_logs");
    const after = await admin().from("audit_logs").select("request_id").eq("request_id", `new-${tag}`);
    expect(after.data).toEqual([]);
  });
});
