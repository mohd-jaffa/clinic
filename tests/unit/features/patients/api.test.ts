// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import type { PatientPayload } from "@/lib/validation";
import { aPatientRow } from "@tests/support/patients";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionSafe } = vi.hoisted(() => ({ logActionSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe }));

const {
  addPatient,
  archivePatient,
  createPatient,
  findPatientMatches,
  getPatient,
  listPatients,
  restorePatient,
  toPatient,
  updatePatient,
} = await import("@/features/patients/api");

function tenantWith(options: FakeSupabaseOptions, member: Partial<Tenant> = {}) {
  const fake = fakeSupabase(options);
  const tenant: Tenant = {
    supabase: fake.client,
    clinicId: "clinic-1",
    actorId: "user-1",
    memberId: "member-1",
    role: "OWNER",
    permissions: [],
    doctorId: null,
    ...member,
  };
  return { ...fake, tenant };
}

const payload: PatientPayload = {
  fullName: "Rohan Mehta",
  phone: "+919876543210",
  born: { dateOfBirth: "1990-04-12", dobIsEstimated: false },
  gender: "MALE",
  assignedDoctorId: "d-1",
  altPhone: null,
  email: null,
  address: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  notes: null,
};

beforeEach(() => logActionSafe.mockReset());

describe("toPatient", () => {
  it("reads a row as the screens do, its doctor by name, archived or not and by whom", () => {
    expect(toPatient(aPatientRow())).toEqual({
      id: "p-1",
      number: 1012,
      name: "Rohan Mehta",
      phone: "+919876543210",
      altPhone: null,
      email: null,
      dateOfBirth: "1990-04-12",
      dobIsEstimated: false,
      gender: "MALE",
      address: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      assignedDoctorId: "d-1",
      doctorName: "Rahul Nair",
      notes: null,
      archivedAt: null,
      archivedBy: null,
    });
    expect(
      toPatient(
        aPatientRow({ doctor: null, archived_at: "2026-10-01T00:00:00Z", archiver: { full_name: "Asha Rao" } }),
      ),
    ).toMatchObject({ doctorName: null, archivedAt: "2026-10-01T00:00:00Z", archivedBy: "Asha Rao" });
    expect(toPatient(aPatientRow({ doctor: { member: null } })).doctorName).toBeNull();
  });
});

describe("getPatient", () => {
  it("reads one of the clinic's patients, or says it is not there", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: aPatientRow() }) });
    expect(await getPatient(tenant, "p-1")).toMatchObject({ id: "p-1", name: "Rohan Mehta" });
    expect(queries[0].table).toBe("patients");
    expect(argsOf(queries[0], "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["id", "p-1"],
    ]);
    await expect(getPatient(tenantWith({ answer: () => ({ data: null }) }).tenant, "p-9")).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
  });
});

describe("addPatient (D145)", () => {
  const essentials = {
    fullName: "Meera Pillai",
    phone: "+919876543210",
    born: { dateOfBirth: "1992-10-11", dobIsEstimated: true },
    gender: "FEMALE" as const,
  };

  it("adds them at once, and reads them back and audits them by name alone, beside what follows", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({ data: { patient_id: "p-1", created: true } }),
      answer: () => ({ data: aPatientRow({ full_name: "Meera Pillai", gender: "FEMALE" }) }),
    });
    const added = await addPatient(tenant, essentials, "key-1", "req_1");
    expect(added.id).toBe("p-1");
    expect(rpcs[0].args).toEqual({
      p_patient: {
        full_name: "Meera Pillai",
        phone: "+919876543210",
        date_of_birth: "1992-10-11",
        dob_is_estimated: true,
        gender: "FEMALE",
      },
      p_idempotency_key: "key-1",
    });
    expect(await added.recorded).toEqual({
      id: "p-1",
      number: 1012,
      name: "Meera Pillai",
      phone: "+919876543210",
      dateOfBirth: "1990-04-12",
      gender: "FEMALE",
      lastVisitOn: null,
      balancePaise: 0,
    });
    expect(logActionSafe).toHaveBeenCalledWith(
      tenant,
      expect.objectContaining({ action: "CREATE", entityId: "p-1", requestId: "req_1" }),
    );
    expect(JSON.stringify(logActionSafe.mock.calls)).not.toMatch(/Meera|9876543210/);
  });

  it("says why they could not be added", async () => {
    const { tenant } = tenantWith({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "AUTH_PERMISSION_DENIED" } }),
    });
    await expect(addPatient(tenant, essentials, "key-1")).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("createPatient (plan §10.1)", () => {
  it("adds them through create_patient with its key, and audits their details by name alone", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({ data: { patient_id: "p-1", created: true } }),
      answer: () => ({ data: aPatientRow() }),
    });
    expect(await createPatient(tenant, payload, "key-1", "req_1")).toMatchObject({ id: "p-1", number: 1012 });
    expect(rpcs).toEqual([
      {
        name: "create_patient",
        args: {
          p_patient: {
            full_name: "Rohan Mehta",
            phone: "+919876543210",
            date_of_birth: "1990-04-12",
            dob_is_estimated: false,
            gender: "MALE",
            assigned_doctor_id: "d-1",
            alt_phone: null,
            email: null,
            address: null,
            emergency_contact_name: null,
            emergency_contact_phone: null,
            notes: null,
          },
          p_idempotency_key: "key-1",
        },
      },
    ]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "CREATE",
      entityType: "patients",
      entityId: "p-1",
      changes: {
        patient_number: { from: null, to: 1012 },
        assigned_doctor_id: { from: null, to: "d-1" },
        fields: ["full_name", "phone", "date_of_birth", "dob_is_estimated", "gender"],
      },
      requestId: "req_1",
    });
    expect(JSON.stringify(logActionSafe.mock.calls)).not.toMatch(/Rohan|9876543210|1990/);
  });

  it("hands back, and audits nothing for, the patient a repeat of the key finds", async () => {
    const { tenant } = tenantWith({
      rpc: () => ({ data: { patient_id: "p-1", created: false } }),
      answer: () => ({ data: aPatientRow() }),
    });
    expect(await createPatient(tenant, payload, "key-1")).toMatchObject({ id: "p-1" });
    expect(logActionSafe).not.toHaveBeenCalled();
  });

  it("refuses in the app's words", async () => {
    const { tenant } = tenantWith({ rpc: () => ({ error: { ...postgrestError("P0001"), hint: "DOCTOR_INACTIVE" } }) });
    await expect(createPatient(tenant, payload, "key-1")).rejects.toMatchObject({
      code: "DOCTOR_INACTIVE",
      kind: "BUSINESS_RULE",
    });
  });
});

describe("updatePatient", () => {
  it("writes only the fields sent, and audits a detail by name and the doctor by value", async () => {
    const { tenant, queries, argsOf } = tenantWith({
      answer: (query) => ({
        data: query.calls.some(([method]) => method === "update")
          ? aPatientRow({ full_name: "Rohan M", assigned_doctor_id: "d-2" })
          : aPatientRow(),
      }),
    });
    expect(await updatePatient(tenant, "p-1", { fullName: "Rohan M", assignedDoctorId: "d-2" }, "req_2")).toMatchObject(
      { name: "Rohan M", assignedDoctorId: "d-2" },
    );
    const write = queries.find((query) => argsOf(query, "update").length > 0)!;
    expect(argsOf(write, "update")).toEqual([[{ full_name: "Rohan M", assigned_doctor_id: "d-2" }]]);
    expect(logActionSafe).toHaveBeenCalledWith(
      tenant,
      expect.objectContaining({
        action: "UPDATE",
        changes: { assigned_doctor_id: { from: "d-1", to: "d-2" }, fields: ["full_name"] },
      }),
    );
  });

  it("writes a birth as its date and whether it was estimated", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: aPatientRow() }) });
    await updatePatient(tenant, "p-1", { born: { dateOfBirth: "1986-10-03", dobIsEstimated: true } });
    const write = queries.find((query) => argsOf(query, "update").length > 0)!;
    expect(argsOf(write, "update")).toEqual([[{ date_of_birth: "1986-10-03", dob_is_estimated: true }]]);
  });

  it("refuses a change to an archived patient in the app's words (D103)", async () => {
    const { tenant } = tenantWith({
      answer: (query) =>
        query.calls.some(([method]) => method === "update")
          ? { error: { ...postgrestError("P0001"), hint: "PATIENT_ARCHIVED" } }
          : { data: aPatientRow() },
    });
    await expect(updatePatient(tenant, "p-1", { fullName: "Changed" })).rejects.toMatchObject({
      code: "PATIENT_ARCHIVED",
      kind: "BUSINESS_RULE",
    });
  });
});

describe("archivePatient and restorePatient (D103)", () => {
  const ARCHIVED_AT = "2026-10-04T05:00:00.000Z";

  it("archives a patient — the database stamps when and by whom — audited as an archive", async () => {
    vi.useFakeTimers({ now: new Date(ARCHIVED_AT), toFake: ["Date"] });
    const { tenant, queries, argsOf } = tenantWith({
      answer: (query) => ({
        data: query.calls.some(([method]) => method === "update")
          ? aPatientRow({ archived_at: ARCHIVED_AT, archiver: { full_name: "Asha Rao" } })
          : aPatientRow(),
      }),
    });
    expect(await archivePatient(tenant, "p-1", "req_3")).toMatchObject({
      archivedAt: ARCHIVED_AT,
      archivedBy: "Asha Rao",
    });
    vi.useRealTimers();
    const write = queries.find((query) => argsOf(query, "update").length > 0)!;
    expect(argsOf(write, "update")).toEqual([[{ archived_at: ARCHIVED_AT }]]);
    expect(logActionSafe).toHaveBeenCalledWith(
      tenant,
      expect.objectContaining({
        action: "ARCHIVE",
        entityType: "patients",
        entityId: "p-1",
        changes: { archived_at: { from: null, to: ARCHIVED_AT } },
        requestId: "req_3",
      }),
    );
  });

  it("refuses to archive one already archived, in the app's words", async () => {
    const { tenant } = tenantWith({
      answer: (query) =>
        query.calls.some(([method]) => method === "update")
          ? { error: { ...postgrestError("P0001"), hint: "PATIENT_ARCHIVED" } }
          : { data: aPatientRow({ archived_at: ARCHIVED_AT }) },
    });
    await expect(archivePatient(tenant, "p-1")).rejects.toMatchObject({ code: "PATIENT_ARCHIVED" });
    expect(logActionSafe).not.toHaveBeenCalled();
  });

  it("restores a patient, audited as a restore", async () => {
    const { tenant, queries, argsOf } = tenantWith({
      answer: (query) => ({
        data: query.calls.some(([method]) => method === "update")
          ? aPatientRow()
          : aPatientRow({ archived_at: ARCHIVED_AT, archiver: { full_name: "Asha Rao" } }),
      }),
    });
    expect(await restorePatient(tenant, "p-1", "req_4")).toMatchObject({ archivedAt: null, archivedBy: null });
    const write = queries.find((query) => argsOf(query, "update").length > 0)!;
    expect(argsOf(write, "update")).toEqual([[{ archived_at: null }]]);
    expect(logActionSafe).toHaveBeenCalledWith(
      tenant,
      expect.objectContaining({ action: "RESTORE", changes: { archived_at: { from: ARCHIVED_AT, to: null } } }),
    );
  });

  it("leaves one who is not archived as they are, with nothing audited", async () => {
    const { tenant } = tenantWith({ answer: () => ({ data: aPatientRow() }) });
    expect(await restorePatient(tenant, "p-1")).toMatchObject({ archivedAt: null });
    expect(logActionSafe).not.toHaveBeenCalled();
  });
});

describe("findPatientMatches (D106)", () => {
  it("reads the clinic's patients with a mobile, newest first, a few at most", async () => {
    const { tenant, queries, argsOf } = tenantWith({
      answer: () => ({
        data: [
          {
            id: "p-8",
            patient_number: 1008,
            full_name: "Riya Mehta",
            date_of_birth: "2020-02-03",
            gender: "FEMALE",
            archived_at: null,
          },
          {
            id: "p-7",
            patient_number: 1007,
            full_name: "Anita Mehta",
            date_of_birth: "1991-06-14",
            gender: "FEMALE",
            archived_at: "2026-09-01T00:00:00Z",
          },
        ],
      }),
    });
    expect(await findPatientMatches(tenant, "+919876543210")).toEqual([
      { id: "p-8", number: 1008, name: "Riya Mehta", dateOfBirth: "2020-02-03", gender: "FEMALE", archived: false },
      { id: "p-7", number: 1007, name: "Anita Mehta", dateOfBirth: "1991-06-14", gender: "FEMALE", archived: true },
    ]);
    expect(argsOf(queries[0], "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["phone", "+919876543210"],
    ]);
    expect(argsOf(queries[0], "order")).toEqual([["patient_number", { ascending: false }]]);
    expect(argsOf(queries[0], "limit")).toEqual([[10]]);
  });

  it("answers none with none, and a failure in the app's words", async () => {
    expect(await findPatientMatches(tenantWith({ answer: () => ({ data: null }) }).tenant, "+91")).toEqual([]);
    await expect(
      findPatientMatches(tenantWith({ answer: () => ({ error: postgrestError("42501") }) }).tenant, "+91"),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("listPatients (plan §10.2, D104)", () => {
  const row = (number: number) => ({
    id: `p-${number}`,
    patient_number: number,
    full_name: "Rohan Mehta",
    phone: "+919876543210",
    date_of_birth: "1990-04-12",
    gender: "MALE",
    last_visit_on: number === 1100 ? "2026-09-28" : null,
    balance: number === 1100 ? [{ balance_paise: 120_000 }] : null,
  });

  it("asks search_patients as the caller for a page and one more, so it knows another follows", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => row(1100 - index));
    const { tenant, rpcs, rpcChains } = tenantWith({ rpc: () => ({ data: rows }) });
    const page = await listPatients(tenant, { search: null, tab: "ALL" });
    expect(rpcs).toEqual([
      {
        name: "search_patients",
        args: {
          p_words: null,
          p_digits: null,
          p_number: null,
          p_archived: false,
          p_owing: false,
          p_offset: 0,
          p_limit: 21,
        },
      },
    ]);
    expect(rpcChains[0]).toEqual([
      [
        "select",
        "id, patient_number, full_name, phone, date_of_birth, gender, last_visit_on, " +
          "balance:patient_balances!patient_balances_patient_id_clinic_id_fkey(balance_paise)",
      ],
    ]);
    expect(page.items).toHaveLength(20);
    expect(page.items[0]).toEqual({
      id: "p-1100",
      number: 1100,
      name: "Rohan Mehta",
      phone: "+919876543210",
      dateOfBirth: "1990-04-12",
      gender: "MALE",
      lastVisitOn: "2026-09-28",
      balancePaise: 120_000,
    });
    expect(page.items[1]).toMatchObject({ lastVisitOn: null, balancePaise: 0 });
    expect(page.nextCursor).toBe("20");
  });

  it("reads a search as words, a mobile's digits and a number, from where the page starts", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: [row(1012)] }) });
    const page = await listPatients(tenant, { search: "1012", tab: "ALL", cursor: 20 });
    expect(rpcs[0].args).toEqual({
      p_words: "1012",
      p_digits: "1012",
      p_number: 1012,
      p_archived: false,
      p_owing: false,
      p_offset: 20,
      p_limit: 21,
    });
    expect(page.nextCursor).toBeNull();
  });

  it("reads the archived for those who may restore them, and refuses them to anyone else", async () => {
    const editor = tenantWith({ rpc: () => ({ data: null }) }, { role: "STAFF", permissions: ["patients.edit"] });
    expect(await listPatients(editor.tenant, { search: null, tab: "ARCHIVED" })).toEqual({
      items: [],
      nextCursor: null,
    });
    expect(editor.rpcs[0].args).toMatchObject({ p_archived: true });

    const viewer = tenantWith({ rpc: () => ({ data: [] }) }, { role: "STAFF", permissions: ["patients.view"] });
    await expect(listPatients(viewer.tenant, { search: null, tab: "ARCHIVED" })).rejects.toMatchObject({
      kind: "AUTHORIZATION",
    });
    expect(viewer.rpcs).toEqual([]);
  });

  it("reads those who owe for those who read payments (D101), and refuses them to anyone else", async () => {
    const desk = tenantWith(
      { rpc: () => ({ data: [] }) },
      { role: "STAFF", permissions: ["patients.view", "payments.view"] },
    );
    await listPatients(desk.tenant, { search: null, tab: "OWING" });
    expect(desk.rpcs[0].args).toMatchObject({ p_archived: false, p_owing: true });

    const viewer = tenantWith({ rpc: () => ({ data: [] }) }, { role: "STAFF", permissions: ["patients.view"] });
    await expect(listPatients(viewer.tenant, { search: null, tab: "OWING" })).rejects.toMatchObject({
      kind: "AUTHORIZATION",
    });
    expect(viewer.rpcs).toEqual([]);
  });

  it("refuses in the app's words", async () => {
    const { tenant } = tenantWith({ rpc: () => ({ error: postgrestError("42501") }) });
    await expect(listPatients(tenant, { search: "Rohan", tab: "ALL" })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});
