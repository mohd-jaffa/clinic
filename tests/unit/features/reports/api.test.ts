// @vitest-environment node
import { describe, expect, it } from "vitest";

import { getDailyReport, getMonthlyReport, type DailyRow, type MonthlyRow } from "@/features/reports/api";
import type { Tenant } from "@/lib/supabase/tenant";
import { aDailyReport, aMonthlyReport } from "@tests/support/reports";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant = { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1" } as unknown as Tenant;
  return { ...fake, tenant };
}

const daily: DailyRow = {
  day: "2026-10-27",
  patients_seen: 9,
  appointments: 12,
  statuses: { COMPLETED: 9, CANCELLED: 2, NO_SHOW: 1, ARRIVED: 2 },
  collected_paise: 1_250_000,
  billed_paise: 1_480_000,
  expenses_paise: 250_000,
  net_paise: 1_000_000,
  collections: [
    {
      received_by: "user-2",
      receiver_name: "Priya Nair",
      method: "CASH",
      payments: 4,
      received_paise: 1_250_000,
      refunds: 0,
      refunded_paise: 0,
    },
  ],
  voided: { payments: 0, payment_paise: 0, refunds: 0, refund_paise: 0 },
};

const monthly: MonthlyRow = {
  month: "2026-10-01",
  patients_seen: 140,
  new_patients: 38,
  returning_patients: 102,
  appointments: 186,
  statuses: { COMPLETED: 160, SCHEDULED: 6, CONFIRMED: 4, NO_SHOW: 8, CANCELLED: 12 },
  collected_paise: 32_000_000,
  billed_paise: 35_500_000,
  expenses_paise: 9_000_000,
  net_paise: 23_000_000,
  outstanding_paise: 1_200_000,
  days: [
    { day: "2026-10-01", collected_paise: 1_200_000, expenses_paise: 900_000 },
    { day: "2026-10-02", collected_paise: 0, expenses_paise: 0 },
    { day: "2026-10-03", collected_paise: 400_000, expenses_paise: 0 },
  ],
  doctors: [
    {
      doctor_id: "d-1",
      doctor_name: "Maya Rao",
      patients_seen: 80,
      visits: 95,
      billed_paise: 20_000_000,
      paid_paise: 18_000_000,
    },
    { doctor_id: null, doctor_name: null, patients_seen: 0, visits: 0, billed_paise: 300_000, paid_paise: 300_000 },
  ],
};

const refused = { error: { ...postgrestError("P0001"), hint: "AUTH_PERMISSION_DENIED" } };

describe("getDailyReport (plan §18; D49)", () => {
  it("reads a day in one call", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: daily }) });
    expect(await getDailyReport(tenant, { day: "2026-10-27" })).toEqual(aDailyReport());
    expect(rpcs).toEqual([{ name: "report_daily", args: { p_day: "2026-10-27" } }]);
  });

  it("says what it was refused", async () => {
    const { tenant } = tenantWith({ rpc: () => refused });
    await expect(getDailyReport(tenant, { day: "2026-10-27" })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});

describe("getMonthlyReport (plan §18; D53)", () => {
  it("reads a month in one call, by its first day", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: monthly }) });
    expect(await getMonthlyReport(tenant, { month: "2026-10-01" })).toEqual(aMonthlyReport());
    expect(rpcs).toEqual([{ name: "report_monthly", args: { p_month: "2026-10-01" } }]);
  });

  it("says what it was refused", async () => {
    const { tenant } = tenantWith({ rpc: () => refused });
    await expect(getMonthlyReport(tenant, { month: "2026-10-01" })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});
