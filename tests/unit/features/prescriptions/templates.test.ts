// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrescriptionTemplateContentRow } from "@/features/prescriptions/types";
import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionsSafe, logActionSafe } = vi.hoisted(() => ({ logActionsSafe: vi.fn(), logActionSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionsSafe, logActionSafe }));

const { addTemplate, changeTemplate, listTemplates, ownTemplates } = await import("@/features/prescriptions/templates");

function tenantWith(options: FakeSupabaseOptions, doctorId: string | null = "d-1") {
  const fake = fakeSupabase(options);
  const tenant = { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1", doctorId } as Tenant;
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
const CETIRIZINE_ROW = { ...PARACETAMOL_ROW, medicine: "Cetirizine", strength: "10 mg" };

const fever: PrescriptionTemplateContentRow = {
  name: "Viral fever",
  advice: "Rest",
  active: true,
  items: [PARACETAMOL_ROW],
};
const answer = (before: PrescriptionTemplateContentRow | null, after: PrescriptionTemplateContentRow) => ({
  data: { template_id: "t-1", created: before === null, before, after },
});
const typed = { name: "Viral fever", items: [PARACETAMOL], advice: "Rest" };

beforeEach(() => vi.clearAllMocks());

describe("listTemplates (D241, D242)", () => {
  it("reads a doctor's templates with their medicines in one query, in place and by name", async () => {
    const { tenant, queries } = tenantWith({
      answer: () => ({
        data: [
          {
            id: "t-2",
            name: "viral fever",
            advice: null,
            active: false,
            items: [
              { ...CETIRIZINE_ROW, position: 2 },
              { ...PARACETAMOL_ROW, position: 1 },
            ],
          },
          { id: "t-1", name: "Cough", advice: "Steam", active: true, items: [] },
        ],
      }),
    });
    const templates = await listTemplates(tenant, "d-1");
    expect(templates.map(({ name }) => name)).toEqual(["Cough", "viral fever"]);
    expect(templates[1]).toEqual({
      id: "t-2",
      name: "viral fever",
      advice: null,
      active: false,
      items: [PARACETAMOL, { ...PARACETAMOL, medicine: "Cetirizine", strength: "10 mg" }],
    });
    expect(queries).toEqual([
      {
        table: "prescription_templates",
        calls: [
          [
            "select",
            "id, name, advice, active, items:prescription_template_items(position, medicine, strength, dose, frequency, timing, duration_days, instructions)",
          ],
          ["eq", "clinic_id", "clinic-1"],
          ["eq", "doctor_id", "d-1"],
        ],
      },
    ]);
  });

  it("passes on a failure in the app's words", async () => {
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("42501") }) });
    await expect(listTemplates(tenant, "d-1")).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("ownTemplates (D242)", () => {
  it("reads the doctor's own for their screens, and nothing for anyone else", async () => {
    const { tenant } = tenantWith({ answer: () => ({ data: [] }) });
    const reads = ownTemplates(tenant);
    expect(Object.keys(reads)).toEqual(["/api/prescription-templates?doctorId=d-1"]);
    await expect(reads["/api/prescription-templates?doctorId=d-1"](tenant)).resolves.toEqual([]);
    expect(ownTemplates(tenantWith({}, null).tenant)).toEqual({});
  });
});

describe("addTemplate (D240, D243)", () => {
  it("makes one through save_prescription_template, audited as made — the medicines and advice by name alone", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => answer(null, fever) });
    expect(await addTemplate(tenant, { template: typed, replace: false }, "req_t")).toEqual({
      id: "t-1",
      ...typed,
      active: true,
    });
    expect(rpcs).toEqual([
      {
        name: "save_prescription_template",
        args: {
          p_template_id: null,
          p_template: { name: "Viral fever", advice: "Rest", items: [PARACETAMOL_ROW] },
          p_replace: false,
        },
      },
    ]);
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      {
        action: "CREATE",
        entityType: "prescription_templates",
        entityId: "t-1",
        changes: { name: { from: null, to: "Viral fever" }, fields: ["items", "advice"] },
        requestId: "req_t",
      },
    ]);
  });

  it("replaces another of the same name once asked, audited by what changed; the same again is not audited", async () => {
    const before = { ...fever, name: "viral fever", items: [CETIRIZINE_ROW] };
    const { tenant, rpcs } = tenantWith({ rpc: () => answer(before, fever) });
    await addTemplate(tenant, { template: typed, replace: true });
    expect(rpcs[0].args).toMatchObject({ p_replace: true });
    expect(logActionsSafe).toHaveBeenCalledWith(tenant, [
      expect.objectContaining({
        action: "UPDATE",
        changes: { name: { from: "viral fever", to: "Viral fever" }, fields: ["items"] },
      }),
    ]);

    logActionsSafe.mockClear();
    const same = tenantWith({ rpc: () => answer({ ...fever, items: [] }, { ...fever, items: [] }) });
    await addTemplate(same.tenant, { template: { ...typed, items: [] }, replace: true });
    expect(logActionsSafe).not.toHaveBeenCalled();
  });

  it("passes on a refusal in the app's words", async () => {
    const { tenant } = tenantWith({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "TEMPLATE_NAME_TAKEN" } }),
    });
    await expect(addTemplate(tenant, { template: typed, replace: false })).rejects.toMatchObject({
      code: "TEMPLATE_NAME_TAKEN",
      kind: "CONFLICT",
    });
  });
});

describe("changeTemplate (D242)", () => {
  it("saves its contents through save_prescription_template, by its id, never replacing another", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => answer(fever, { ...fever, active: false, advice: null }) });
    expect(await changeTemplate(tenant, "t-1", { template: { ...typed, advice: null } })).toMatchObject({
      id: "t-1",
      active: false,
      advice: null,
    });
    expect(rpcs[0].args).toMatchObject({ p_template_id: "t-1", p_replace: false });
  });

  it("archives and restores it by its active alone, audited as that, a name in use refused", async () => {
    const row = { id: "t-1", name: "Viral fever", advice: null, items: [{ ...PARACETAMOL_ROW, position: 1 }] };
    const archive = tenantWith({
      answer: (query) =>
        query.calls.some(([method]) => method === "update")
          ? { data: { ...row, active: false } }
          : { data: { ...row, active: true } },
    });
    expect(await changeTemplate(archive.tenant, "t-1", { active: false }, "req_a")).toMatchObject({
      id: "t-1",
      active: false,
      items: [PARACETAMOL],
    });
    expect(logActionSafe).toHaveBeenCalledWith(archive.tenant, {
      action: "ARCHIVE",
      entityType: "prescription_templates",
      entityId: "t-1",
      changes: { active: { from: true, to: false } },
      requestId: "req_a",
    });

    const restore = tenantWith({
      answer: (query) =>
        query.calls.some(([method]) => method === "update")
          ? { error: postgrestError("23505") }
          : { data: { ...row, active: false } },
    });
    await expect(changeTemplate(restore.tenant, "t-1", { active: true })).rejects.toMatchObject({
      code: "TEMPLATE_NAME_TAKEN",
    });
  });
});
