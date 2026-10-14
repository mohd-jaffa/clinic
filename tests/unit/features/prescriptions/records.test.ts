// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrescriptionContent, PrescriptionRow } from "@/features/prescriptions/types";
import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionsSafe } = vi.hoisted(() => ({ logActionsSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionsSafe }));

const { savePrescription } = await import("@/features/prescriptions/records");

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant = { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1" } as Tenant;
  return { ...fake, tenant };
}

const PARACETAMOL = {
  medicine: "Paracetamol",
  strength: "500 mg",
  dose: "1 tab",
  frequency: "1-0-1",
  timing: "AFTER_FOOD",
  durationDays: 5,
  instructions: null,
} as const;
const PARACETAMOL_ROW = {
  medicine: "Paracetamol",
  strength: "500 mg",
  dose: "1 tab",
  frequency: "1-0-1",
  timing: "AFTER_FOOD",
  duration_days: 5,
  instructions: null,
} as const;
const written: PrescriptionContent = { items: [PARACETAMOL], advice: "Rest", printDiagnosis: false };
const writtenRow: PrescriptionRow = { items: [PARACETAMOL_ROW], advice: "Rest", print_diagnosis: false };
const answer = (before: PrescriptionRow | null, after: PrescriptionRow, created = before === null) => ({
  data: { prescription_id: "rx-1", created, before, after },
});

beforeEach(() => vi.clearAllMocks());

describe("savePrescription (D210, D206)", () => {
  it("saves the whole through save_prescription, audited as made — the medicines and advice by name alone", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => answer(null, writtenRow) });
    expect(await savePrescription(tenant, "v-1", { prescription: written, seen: null }, "req_rx")).toEqual({
      prescription: written,
    });
    expect(rpcs).toEqual([
      { name: "save_prescription", args: { p_visit_id: "v-1", p_prescription: writtenRow, p_seen: null } },
    ]);
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "CREATE",
        entityType: "prescriptions",
        entityId: "rx-1",
        changes: { print_diagnosis: { from: null, to: false }, fields: ["items", "advice"] },
        requestId: "req_rx",
      },
    ]);
  });

  it("names no medicines for one made with none, but still records that it was made", async () => {
    const empty: PrescriptionRow = { items: [], advice: null, print_diagnosis: false };
    const { tenant } = tenantWith({ rpc: () => answer(null, empty) });
    await savePrescription(tenant, "v-1", {
      prescription: { items: [], advice: null, printDiagnosis: false },
      seen: null,
    });
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      expect.objectContaining({ action: "CREATE", changes: { print_diagnosis: { from: null, to: false } } }),
    ]);
  });

  it("sends the copy read, and audits a change by what changed: the medicines as one, the tick by its value", async () => {
    const after: PrescriptionRow = {
      ...writtenRow,
      items: [{ ...PARACETAMOL_ROW, duration_days: 3 }],
      print_diagnosis: true,
    };
    const { tenant, rpcs } = tenantWith({ rpc: () => answer(writtenRow, after) });
    const saved = await savePrescription(tenant, "v-1", {
      prescription: { ...written, items: [{ ...PARACETAMOL, durationDays: 3 }], printDiagnosis: true },
      seen: written,
    });
    expect(saved.prescription.items[0].durationDays).toBe(3);
    expect((rpcs[0].args as { p_seen: unknown }).p_seen).toEqual(writtenRow);
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "UPDATE",
        entityType: "prescriptions",
        entityId: "rx-1",
        changes: { print_diagnosis: { from: false, to: true }, fields: ["items"] },
        requestId: undefined,
      },
    ]);
  });

  it("audits nothing for a save that changed nothing", async () => {
    const { tenant } = tenantWith({ rpc: () => answer(writtenRow, writtenRow) });
    await savePrescription(tenant, "v-1", { prescription: written, seen: written });
    expect(logActionsSafe).not.toHaveBeenCalled();
  });

  it("passes on a refusal in the app's words", async () => {
    const { tenant } = tenantWith({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "PRESCRIPTION_NEEDS_REGISTRATION" } }),
    });
    await expect(savePrescription(tenant, "v-1", { prescription: written, seen: null })).rejects.toMatchObject({
      code: "PRESCRIPTION_NEEDS_REGISTRATION",
      kind: "BUSINESS_RULE",
    });
    expect(logActionsSafe).not.toHaveBeenCalled();
  });
});
