// @vitest-environment node
import { describe, expect, it } from "vitest";

import { getDashboard, toDashboard, type SummaryRow } from "@/features/dashboard/api";
import type { Tenant } from "@/lib/supabase/tenant";
import { aDashboard } from "@tests/support/dashboard";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant = { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1" } as unknown as Tenant;
  return { ...fake, tenant };
}

const rohan = { patient_id: "p-1", patient_name: "Rohan Mehta", patient_number: 1001 };
const meera = { patient_id: "p-2", patient_name: "Meera Pillai", patient_number: 1002 };

/** What dashboard_summary hands back for the day `aDashboard` reads. */
const summary: SummaryRow = {
  today: "2026-10-27",
  day: { appointments: 14, patients_seen: 6 },
  money: { collected_paise: 1_250_000, outstanding_paise: 320_000 },
  queue: [
    {
      doctor_id: "d-1",
      doctor_name: "Arun Nair",
      with_doctor: 0,
      waiting: 1,
      next: [{ ...meera, appointment_id: "a-1", token_number: 7, urgent: true }],
    },
    { doctor_id: "d-2", doctor_name: "Maya Rao", with_doctor: 1, waiting: 2, next: [] },
  ],
  to_bill: { count: 3, visits: [{ ...rohan, visit_id: "v-1", doctor_name: "Maya Rao", token_number: 4 }] },
  follow_ups: {
    today: 1,
    overdue: 2,
    lapsed: 1,
    due: [
      {
        ...meera,
        kind: "TREATMENT",
        treatment_id: "t-1",
        visit_id: null,
        title: "Root canal",
        doctor_name: "Maya Rao",
      },
    ],
  },
  upcoming: {
    count: 1,
    appointments: [
      {
        ...rohan,
        appointment_id: "a-2",
        scheduled_at: "2026-10-28T05:00:00.000Z",
        doctor_name: "Maya Rao",
        type_name: "Consultation",
      },
    ],
  },
  owing: [{ ...rohan, balance_paise: 30_000 }],
  payments: [
    {
      ...meera,
      payment_id: "pay-1",
      kind: "PAYMENT",
      amount_paise: 50_000,
      method: "UPI",
      paid_at: "2026-10-27T05:10:00.000Z",
    },
  ],
  expenses: [
    {
      expense_id: "e-1",
      category_name: "Supplies",
      description: "Gauze",
      amount_paise: 25_000,
      day: "2026-10-27",
      method: "CASH",
    },
  ],
  getting_started: null,
};

const closed: SummaryRow = {
  today: "2026-10-27",
  day: null,
  money: null,
  queue: null,
  to_bill: null,
  follow_ups: null,
  upcoming: null,
  owing: null,
  payments: null,
  expenses: null,
  getting_started: { prices: true, team: false },
};

describe("toDashboard (plan §17)", () => {
  it("reads every section the caller may see", () => {
    expect(toDashboard(summary)).toEqual(aDashboard());
  });

  it("keeps a section without its permission as none, and a visit's follow-up by the visit", () => {
    expect(toDashboard(closed)).toEqual({
      today: "2026-10-27",
      day: null,
      money: null,
      queue: null,
      toBill: null,
      followUps: null,
      upcoming: null,
      owing: null,
      payments: null,
      expenses: null,
      gettingStarted: { prices: true, team: false },
    });
    const visit = { ...summary.follow_ups!.due[0], kind: "VISIT" as const, treatment_id: null, visit_id: "v-9" };
    expect(
      toDashboard({ ...summary, follow_ups: { ...summary.follow_ups!, due: [visit] } }).followUps!.due[0],
    ).toMatchObject({ kind: "VISIT", id: "v-9" });
  });
});

describe("getDashboard (plan §17; D349)", () => {
  it("reads Home in one call, with Home's list sizes", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: summary }) });
    expect(await getDashboard(tenant)).toEqual(aDashboard());
    expect(rpcs).toEqual([{ name: "dashboard_summary", args: { p_list_limit: 5, p_queue_limit: 3 } }]);
  });

  it("says what it was refused", async () => {
    const { tenant } = tenantWith({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "AUTH_PERMISSION_DENIED" } }),
    });
    await expect(getDashboard(tenant)).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});
