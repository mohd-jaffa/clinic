// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  getConsoleClinic,
  getConsoleOverview,
  listConsoleAccounts,
  listConsoleAudit,
  listConsoleClinics,
  listConsoleErrors,
  type AccountRow,
  type ClinicRow,
  type ErrorRow,
} from "@/features/admin/api";
import { fakeSupabase, postgrestError } from "@tests/support/supabase";

const clinicRow: ClinicRow = {
  id: "c-1",
  name: "Smile Care",
  clinic_type: "DENTAL",
  city: "Kochi",
  signed_up_at: "2026-10-01T05:00:00.000Z",
  owner_name: "Asha Menon",
  owner_email: "asha@smilecare.in",
  owner_phone: "+919845012345",
  plan: "TRIAL",
  valid_until: "2026-08-01",
  state: "READ_ONLY",
  bucket: "READ_ONLY",
  members: 3,
  no_trial: true,
};

describe("the console's reads (plan §20)", () => {
  it("reads the Overview in one call, in the app's own names", async () => {
    const { client, rpcs } = fakeSupabase({
      rpc: () => ({
        data: {
          today: "2026-10-28",
          clinics: 5,
          buckets: { TRIAL: 2, ACTIVE: 1, EXPIRING: 1, GRACE: 0, READ_ONLY: 1 },
          no_trial: 1,
          signups_week: 1,
          signups_month: 4,
          extensions_month: 2,
        },
      }),
    });
    expect(await getConsoleOverview(client)).toEqual({
      today: "2026-10-28",
      clinics: 5,
      standings: { TRIAL: 2, ACTIVE: 1, EXPIRING: 1, GRACE: 0, READ_ONLY: 1 },
      noTrial: 1,
      signupsWeek: 1,
      signupsMonth: 4,
      extensionsMonth: 2,
    });
    expect(rpcs).toEqual([{ name: "console_overview", args: undefined }]);
  });

  it("asks for a page of clinics by the words and digits typed and the filter, one row more than a page", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({ ...clinicRow, id: `c-${index}` }));
    const { client, rpcs } = fakeSupabase({ rpc: () => ({ data: rows }) });
    const page = await listConsoleClinics(client, { search: "Asha 98450", filter: "NO_TRIAL", cursor: 25 });
    expect(rpcs[0]).toEqual({
      name: "console_clinics",
      args: { p_words: "Asha 98450", p_digits: "98450", p_filter: "NO_TRIAL", p_offset: 25, p_limit: 21 },
    });
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toBe("45");
    expect(page.items[0]).toEqual({
      id: "c-0",
      name: "Smile Care",
      type: "DENTAL",
      city: "Kochi",
      signedUpAt: "2026-10-01T05:00:00.000Z",
      owner: { name: "Asha Menon", email: "asha@smilecare.in", phone: "+919845012345" },
      plan: "TRIAL",
      validUntil: "2026-08-01",
      state: "READ_ONLY",
      standing: "READ_ONLY",
      members: 3,
      noTrial: true,
    });

    const all = fakeSupabase({ rpc: () => ({ data: [] }) });
    expect(await listConsoleClinics(all.client, {})).toEqual({ items: [], nextCursor: null });
    expect(all.rpcs[0].args).toEqual({ p_words: null, p_digits: null, p_filter: null, p_offset: 0, p_limit: 21 });
  });

  it("reads one clinic with every change recorded to its plan and the live prices, and says when there is none", async () => {
    const { client } = fakeSupabase({
      rpc: () => ({
        data: {
          ...clinicRow,
          payments: [
            {
              id: "sp-1",
              plan: "MONTHLY",
              amount_paise: 30_000,
              method: "UPI",
              reference: "UPI-4821",
              paid_on: "2026-10-12",
              valid_from: "2026-10-12",
              valid_until: "2026-11-12",
              reason: null,
              receipt_number: "R/2026-27/0001",
              recorded_by_name: "Jaffa",
              created_at: "2026-10-12T05:00:00.000Z",
            },
          ],
          prices: { monthly_paise: 30_000, yearly_paise: 300_000 },
        },
      }),
    });
    const clinic = await getConsoleClinic(client, "c-1");
    expect(clinic.prices).toEqual({ monthlyPaise: 30_000, yearlyPaise: 300_000 });
    expect(clinic.payments).toEqual([
      {
        id: "sp-1",
        kind: "MONTHLY",
        amountPaise: 30_000,
        method: "UPI",
        reference: "UPI-4821",
        paidOn: "2026-10-12",
        validFrom: "2026-10-12",
        validUntil: "2026-11-12",
        reason: null,
        receiptNumber: "R/2026-27/0001",
        recordedBy: "Jaffa",
        recordedAt: "2026-10-12T05:00:00.000Z",
      },
    ]);
    expect(clinic.owner.name).toBe("Asha Menon");

    const none = fakeSupabase({ rpc: () => ({ data: null }) });
    await expect(getConsoleClinic(none.client, "c-9")).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
  });

  it("reads a page of accounts, each with its clinic or none", async () => {
    const member: AccountRow = {
      id: "u-1",
      full_name: "Asha Menon",
      email: "asha@smilecare.in",
      phone: "+919845012345",
      platform_role: null,
      created_at: "2026-10-01T05:00:00.000Z",
      clinic_id: "c-1",
      clinic_name: "Smile Care",
      role: "OWNER",
      status: "ACTIVE",
      last_sign_in_at: "2026-10-27T05:00:00.000Z",
    };
    const developer: AccountRow = {
      ...member,
      id: "u-2",
      platform_role: "DEV",
      clinic_id: null,
      clinic_name: null,
      role: null,
      status: null,
      last_sign_in_at: null,
    };
    const { client, rpcs } = fakeSupabase({ rpc: () => ({ data: [member, developer] }) });
    const page = await listConsoleAccounts(client, { search: "asha" });
    expect(rpcs[0].args).toEqual({ p_words: "asha", p_digits: null, p_offset: 0, p_limit: 21 });
    expect(page.items[0].membership).toEqual({
      clinicId: "c-1",
      clinicName: "Smile Care",
      role: "OWNER",
      status: "ACTIVE",
    });
    expect(page.items[1]).toMatchObject({ platformRole: "DEV", membership: null, lastSignInAt: null });
  });

  it("reads a page of the error log the latest first, whole, with who asked and for which clinic", async () => {
    const failure: ErrorRow = {
      id: "e-1",
      source: "API",
      message: "Request failed",
      reference: "req_1",
      code: "INTERNAL_ERROR",
      kind: "INTERNAL",
      http_status: 500,
      method: "POST",
      path: "/api/bills",
      detail: "relation does not exist",
      stack: "Error: at x",
      context: { route: "/api/bills" },
      created_at: "2026-10-28T05:00:00.000Z",
      account: { full_name: "Asha Menon", email: "asha@smilecare.in" },
      clinic: { name: "Smile Care" },
    };
    const { client, queries } = fakeSupabase({
      answer: () => ({ data: [failure, { ...failure, id: "e-2", account: null, clinic: null }] }),
    });
    const page = await listConsoleErrors(client, { cursor: 25 });
    expect(queries[0].table).toBe("error_logs");
    expect(queries[0].calls).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(queries[0].calls).toContainEqual(["range", 25, 45]);
    expect(page.items[0]).toMatchObject({
      httpStatus: 500,
      account: { name: "Asha Menon", email: "asha@smilecare.in" },
      clinicName: "Smile Care",
      at: "2026-10-28T05:00:00.000Z",
    });
    expect(page.items[1]).toMatchObject({ account: null, clinicName: null });
    expect((await listConsoleErrors(fakeSupabase({ answer: () => ({ data: [] }) }).client, {})).items).toEqual([]);
  });

  it("reads a page of the platform audit", async () => {
    const { client, rpcs } = fakeSupabase({
      rpc: () => ({
        data: [
          {
            id: "a-1",
            action: "UPDATE",
            entity_type: "platform_settings",
            changes: { trial_days: { from: 30, to: 45 } },
            request_id: "req_1",
            created_at: "2026-10-28T05:00:00.000Z",
            actor_name: "Jaffa",
            clinic_name: null,
          },
        ],
      }),
    });
    const page = await listConsoleAudit(client, {});
    expect(rpcs[0]).toEqual({ name: "console_audit", args: { p_offset: 0, p_limit: 21 } });
    expect(page.items[0]).toEqual({
      id: "a-1",
      action: "UPDATE",
      entityType: "platform_settings",
      changes: { trial_days: { from: 30, to: 45 } },
      requestId: "req_1",
      actorName: "Jaffa",
      clinicName: null,
      at: "2026-10-28T05:00:00.000Z",
    });
  });

  it("is refused as the database refuses it", async () => {
    const refused = fakeSupabase({
      rpc: () => ({ error: postgrestError("42501") }),
      answer: () => ({ error: postgrestError("42501") }),
    });
    for (const read of [
      () => getConsoleOverview(refused.client),
      () => listConsoleClinics(refused.client, {}),
      () => getConsoleClinic(refused.client, "c-1"),
      () => listConsoleAccounts(refused.client, {}),
      () => listConsoleErrors(refused.client, {}),
      () => listConsoleAudit(refused.client, {}),
    ]) {
      await expect(read()).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    }
  });
});
