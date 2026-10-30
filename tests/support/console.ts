import type {
  ConsoleAccount,
  ConsoleAuditEntry,
  ConsoleClinic,
  ConsoleClinicDetail,
  ConsoleError,
  ConsoleOverview,
} from "@/features/admin/types";

/** The console's Overview on 28 Oct (plan §20.1): five clinics, one waiting for activation. */
export function aConsoleOverview(overrides: Partial<ConsoleOverview> = {}): ConsoleOverview {
  return {
    today: "2026-10-28",
    clinics: 5,
    standings: { TRIAL: 2, ACTIVE: 1, EXPIRING: 1, GRACE: 0, READ_ONLY: 1 },
    noTrial: 1,
    signupsWeek: 1,
    signupsMonth: 4,
    extensionsMonth: 2,
    ...overrides,
  };
}

/** A clinic on its trial, as the console lists it (plan §20.2). */
export function aConsoleClinic(overrides: Partial<ConsoleClinic> = {}): ConsoleClinic {
  return {
    id: "c-1",
    name: "Smile Care",
    type: "DENTAL",
    city: "Kochi",
    signedUpAt: "2026-10-01T05:00:00.000Z",
    owner: { name: "Asha Menon", email: "asha@smilecare.in", phone: "+919845012345" },
    plan: "TRIAL",
    validUntil: "2026-10-31",
    state: "EXPIRING",
    standing: "TRIAL",
    members: 3,
    noTrial: false,
    ...overrides,
  };
}

/** The same clinic's page (plan §20.3): a month paid for, and ten days given before it; the prices of today. */
export function aConsoleClinicDetail(overrides: Partial<ConsoleClinicDetail> = {}): ConsoleClinicDetail {
  return {
    ...aConsoleClinic({ plan: "MONTHLY", validUntil: "2026-12-10", state: "ACTIVE", standing: "ACTIVE" }),
    payments: [
      {
        id: "sp-2",
        kind: "MONTHLY",
        amountPaise: 30_000,
        method: "UPI",
        reference: "UPI-4821",
        paidOn: "2026-10-28",
        validFrom: "2026-11-10",
        validUntil: "2026-12-10",
        reason: null,
        receiptNumber: "R/2026-27/0001",
        recordedBy: "Jaffa",
        recordedAt: "2026-10-28T05:00:00.000Z",
      },
      {
        id: "sp-1",
        kind: "CUSTOM",
        amountPaise: 0,
        method: null,
        reference: null,
        paidOn: null,
        validFrom: "2026-10-31",
        validUntil: "2026-11-10",
        reason: "Ten days for the move",
        receiptNumber: null,
        recordedBy: null,
        recordedAt: "2026-10-20T05:00:00.000Z",
      },
    ],
    prices: { monthlyPaise: 30_000, yearlyPaise: 300_000 },
    ...overrides,
  };
}

/** A clinic's owner, as Accounts lists them (plan §20.5). */
export function aConsoleAccount(overrides: Partial<ConsoleAccount> = {}): ConsoleAccount {
  return {
    id: "u-1",
    name: "Asha Menon",
    email: "asha@smilecare.in",
    phone: "+919845012345",
    platformRole: null,
    createdAt: "2026-10-01T05:00:00.000Z",
    membership: { clinicId: "c-1", clinicName: "Smile Care", role: "OWNER", status: "ACTIVE" },
    lastSignInAt: "2026-10-28T05:00:00.000Z",
    ...overrides,
  };
}

/** A request the server failed (plan §20.6), whole. */
export function aConsoleError(overrides: Partial<ConsoleError> = {}): ConsoleError {
  return {
    id: "e-1",
    source: "API",
    message: "Request failed",
    reference: "req_4821",
    code: "INTERNAL_ERROR",
    kind: "INTERNAL",
    httpStatus: 500,
    method: "POST",
    path: "/api/bills",
    account: { name: "Asha Menon", email: "asha@smilecare.in" },
    clinicName: "Smile Care",
    detail: 'relation "bills" does not exist',
    stack: "Error: relation\n    at createBill",
    context: { route: "/api/bills" },
    at: "2026-10-28T05:00:00.000Z",
    ...overrides,
  };
}

/** The settings changed (plan §20.7). */
export function anAuditEntry(overrides: Partial<ConsoleAuditEntry> = {}): ConsoleAuditEntry {
  return {
    id: "a-1",
    action: "UPDATE",
    entityType: "platform_settings",
    changes: { trial_days: { from: 30, to: 45 } },
    requestId: "req_1",
    actorName: "Jaffa",
    clinicName: null,
    at: "2026-10-28T05:00:00.000Z",
    ...overrides,
  };
}
