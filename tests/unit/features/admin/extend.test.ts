// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClinicDetailRow } from "@/features/admin/api";
import type { ExtendPlanPayload } from "@/lib/validation";
import { fakeSupabase, postgrestError } from "@tests/support/supabase";

const mocks = vi.hoisted(() => ({ captureError: vi.fn(), sendPlanExtended: vi.fn() }));
vi.mock("@/lib/audit/errorLog", () => ({ captureError: mocks.captureError }));
vi.mock("@/lib/mail/nodemailer.provider", () => ({
  createConfiguredMailService: () => ({ sendPlanExtended: mocks.sendPlanExtended }),
}));
vi.mock("@/lib/env/server", () => ({ getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://clinicdesk.test" }) }));

const { extendPlan } = await import("@/features/admin/extend");

const KEY = "3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f";
const who = { requestId: "req_1", userId: "dev-1" };

/** A month paid for by UPI today. */
const month: ExtendPlanPayload = {
  kind: "MONTHLY",
  amountPaise: 30_000,
  method: "UPI",
  paidOn: "2026-10-30",
  reference: "UPI-4821",
  validUntil: null,
  reason: null,
};

/** The clinic as the console sees it once the month is recorded. */
const clinicRow: ClinicDetailRow = {
  id: "c-1",
  name: "Smile Care",
  clinic_type: "DENTAL",
  city: "Kochi",
  signed_up_at: "2026-10-01T05:00:00.000Z",
  owner_name: "Asha Menon",
  owner_email: "asha@smilecare.in",
  owner_phone: "+919845012345",
  plan: "MONTHLY",
  valid_until: "2026-12-12",
  state: "ACTIVE",
  bucket: "ACTIVE",
  members: 3,
  no_trial: false,
  payments: [
    {
      id: "sp-2",
      plan: "MONTHLY",
      amount_paise: 30_000,
      method: "UPI",
      reference: "UPI-4821",
      paid_on: "2026-10-30",
      valid_from: "2026-11-12",
      valid_until: "2026-12-12",
      reason: null,
      receipt_number: "R/2026-27/0007",
      recorded_by_name: "Jaffa",
      created_at: "2026-10-30T05:00:00.000Z",
    },
  ],
  prices: { monthly_paise: 30_000, yearly_paise: 300_000 },
};

const answered = (created: boolean) =>
  fakeSupabase({ rpc: () => ({ data: { created, payment: { id: "sp-2" }, clinic: clinicRow } }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sendPlanExtended.mockResolvedValue(undefined);
});

describe("extendPlan (plan §7.4; D373 – D376)", () => {
  it("records the extension as the DEV, once per key, and emails the owner what was recorded", async () => {
    const { client, rpcs } = answered(true);
    const extended = await extendPlan(client, "c-1", month, KEY, who);
    expect(rpcs).toEqual([
      {
        name: "extend_clinic_subscription",
        args: {
          p_clinic_id: "c-1",
          p_kind: "MONTHLY",
          p_amount_paise: 30_000,
          p_method: "UPI",
          p_reference: "UPI-4821",
          p_paid_on: "2026-10-30",
          p_valid_until: null,
          p_reason: null,
          p_idempotency_key: KEY,
          p_request_id: "req_1",
        },
      },
    ]);
    expect(extended).toMatchObject({
      clinic: { name: "Smile Care", validUntil: "2026-12-12", prices: { monthlyPaise: 30_000 } },
      payment: { id: "sp-2", receiptNumber: "R/2026-27/0007", recordedBy: "Jaffa" },
      emailSent: true,
    });
    expect(mocks.sendPlanExtended).toHaveBeenCalledWith({
      to: "asha@smilecare.in",
      name: "Asha Menon",
      clinicName: "Smile Care",
      kind: "MONTHLY",
      validFrom: "2026-11-12",
      validUntil: "2026-12-12",
      amountPaise: 30_000,
      method: "UPI",
      paidOn: "2026-10-30",
      receiptNumber: "R/2026-27/0007",
      reason: null,
      planUrl: "https://clinicdesk.test/settings/plan",
    });
  });

  it("keeps the extension when the email fails, logs it, and says so (D376)", async () => {
    const failure = new Error("smtp down");
    mocks.sendPlanExtended.mockRejectedValue(failure);
    const extended = await extendPlan(answered(true).client, "c-1", month, KEY, who);
    expect(extended.emailSent).toBe(false);
    expect(mocks.captureError).toHaveBeenCalledWith({
      message: "Could not send a plan extended email",
      error: failure,
      userId: "dev-1",
      clinicId: "c-1",
      reference: "req_1",
    });
  });

  it("emails no one when the same Extend plan comes again, and answers with what it recorded", async () => {
    const extended = await extendPlan(answered(false).client, "c-1", month, KEY, who);
    expect(extended).toMatchObject({ payment: { id: "sp-2" }, emailSent: null });
    expect(mocks.sendPlanExtended).not.toHaveBeenCalled();
  });

  it("says the database's refusal in the app's words", async () => {
    const { client } = fakeSupabase({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "RECORD_NOT_FOUND" } }),
    });
    await expect(extendPlan(client, "c-9", month, KEY, who)).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    expect(mocks.sendPlanExtended).not.toHaveBeenCalled();
  });
});
