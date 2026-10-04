// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AlertRow } from "@/features/patients/types";
import type { Tenant } from "@/lib/supabase/tenant";
import { aPatientRow } from "@tests/support/patients";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions, type RecordedQuery } from "@tests/support/supabase";

const { logActionSafe } = vi.hoisted(() => ({ logActionSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe }));

const { addAlert, listAlerts, toAlert, updateAlert } = await import("@/features/patients/alerts");

function tenantWith(options: FakeSupabaseOptions, member: Partial<Tenant> = {}) {
  const fake = fakeSupabase(options);
  const tenant: Tenant = {
    supabase: fake.client,
    clinicId: "clinic-1",
    actorId: "user-1",
    memberId: "member-1",
    role: "STAFF",
    permissions: ["patients.view", "visits.view", "visits.edit"],
    doctorId: null,
    ...member,
  };
  return { ...fake, tenant };
}

const anAlertRow = (overrides: Partial<AlertRow> = {}): AlertRow => ({
  id: "a-1",
  patient_id: "p-1",
  kind: "ALLERGY",
  label: "Penicillin",
  note: "Rash, 2019",
  active: true,
  ...overrides,
});

/** The patient is found first; the alert queries answer as the test says. */
const withPatient =
  (alerts: (query: RecordedQuery) => { data?: unknown; error?: unknown }) => (query: RecordedQuery) =>
    query.table === "patients" ? { data: aPatientRow() } : alerts(query);

const wrote = (query: RecordedQuery, method: string) => query.calls.some(([name]) => name === method);

beforeEach(() => logActionSafe.mockReset());

describe("toAlert", () => {
  it("reads a row as the screens do", () => {
    expect(toAlert(anAlertRow())).toEqual({
      id: "a-1",
      kind: "ALLERGY",
      label: "Penicillin",
      note: "Rash, 2019",
      active: true,
    });
  });
});

describe("listAlerts (plan §10.4)", () => {
  it("reads a patient's alerts, turned off ones too, oldest first — once the patient is found", async () => {
    const { tenant, queries, argsOf } = tenantWith({
      answer: withPatient(() => ({ data: [anAlertRow(), anAlertRow({ id: "a-2", active: false })] })),
    });
    expect(await listAlerts(tenant, "p-1")).toEqual([
      expect.objectContaining({ id: "a-1", active: true }),
      expect.objectContaining({ id: "a-2", active: false }),
    ]);
    const [patient, alerts] = queries;
    expect(patient.table).toBe("patients");
    expect(alerts.table).toBe("patient_alerts");
    expect(argsOf(alerts, "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["patient_id", "p-1"],
    ]);
    expect(argsOf(alerts, "order")).toEqual([["created_at"]]);
  });

  it("answers none with none, a patient out of reach as not found, and a failure in the app's words", async () => {
    expect(await listAlerts(tenantWith({ answer: withPatient(() => ({ data: null })) }).tenant, "p-1")).toEqual([]);
    const hidden = tenantWith({ answer: () => ({ data: null }) });
    await expect(listAlerts(hidden.tenant, "p-9")).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    expect(hidden.queries).toHaveLength(1);
    const failing = tenantWith({ answer: withPatient(() => ({ error: postgrestError("42501") })) });
    await expect(listAlerts(failing.tenant, "p-1")).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });

  it("is refused to someone who may not read visits", async () => {
    const { tenant, queries } = tenantWith({}, { role: "STAFF", permissions: ["patients.view"] });
    await expect(listAlerts(tenant, "p-1")).rejects.toMatchObject({ kind: "AUTHORIZATION" });
    expect(queries).toEqual([]);
  });
});

describe("addAlert", () => {
  it("adds it to a patient found first, and audits its words by name alone", async () => {
    const { tenant, queries, argsOf } = tenantWith({
      answer: withPatient(() => ({ data: anAlertRow() })),
    });
    expect(
      await addAlert(tenant, "p-1", { kind: "ALLERGY", label: "Penicillin", note: "Rash, 2019" }, "req_1"),
    ).toMatchObject({ id: "a-1", label: "Penicillin" });
    const insert = queries.find((query) => wrote(query, "insert"))!;
    expect(argsOf(insert, "insert")).toEqual([
      [{ patient_id: "p-1", kind: "ALLERGY", label: "Penicillin", note: "Rash, 2019", clinic_id: "clinic-1" }],
    ]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "CREATE",
      entityType: "patient_alerts",
      entityId: "a-1",
      changes: {
        patient_id: { from: null, to: "p-1" },
        kind: { from: null, to: "ALLERGY" },
        fields: ["label", "note"],
      },
      requestId: "req_1",
    });
    expect(JSON.stringify(logActionSafe.mock.calls)).not.toMatch(/Penicillin|Rash/);
  });

  it("refuses a second active alert of the same name and kind in the app's words", async () => {
    const { tenant } = tenantWith({
      answer: withPatient((query) => (wrote(query, "insert") ? { error: postgrestError("23505") } : { data: null })),
    });
    await expect(addAlert(tenant, "p-1", { kind: "ALLERGY", label: "Penicillin", note: null })).rejects.toMatchObject({
      code: "ALERT_ALREADY_EXISTS",
      kind: "CONFLICT",
    });
  });
});

describe("updateAlert (D118, D119)", () => {
  it("changes only what was sent, and turns an alert off", async () => {
    const { tenant, queries, argsOf } = tenantWith({
      answer: (query) => ({
        data: wrote(query, "update") ? anAlertRow({ active: false }) : anAlertRow(),
      }),
    });
    expect(await updateAlert(tenant, "p-1", "a-1", { active: false }, "req_2")).toMatchObject({ active: false });
    const write = queries.find((query) => wrote(query, "update"))!;
    expect(argsOf(write, "update")).toEqual([[{ active: false }]]);
    expect(logActionSafe).toHaveBeenCalledWith(
      tenant,
      expect.objectContaining({ action: "UPDATE", changes: { active: { from: true, to: false } } }),
    );
  });

  it("finds no alert that is another patient's", async () => {
    const { tenant, queries } = tenantWith({ answer: () => ({ data: anAlertRow({ patient_id: "p-2" }) }) });
    await expect(updateAlert(tenant, "p-1", "a-1", { label: "Amoxicillin" })).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
    expect(queries.some((query) => wrote(query, "update"))).toBe(false);
  });
});
