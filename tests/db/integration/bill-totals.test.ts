import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { billTotals, type BillDiscount, type BillLine } from "@/features/billing/totals";
import { registerClinic, removeAll, type TestClinic } from "@tests/support/integration";

/**
 * The one formula and the database agree (plan §15.1; R8.2, D290 – D293):
 * what billTotals works out — a percentage rounded to the rupee, 100% the
 * whole of a subtotal in paise — is what create_bill works out again and
 * issues; a total a paisa off, or a discount past the subtotal, it refuses.
 */
let clinic: TestClinic;
let patientId: string;

beforeAll(async () => {
  clinic = await registerClinic();
  const { data, error } = await clinic.owner.tenant.supabase
    .rpc("create_patient", {
      p_patient: { full_name: "Rohan Mehta", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  patientId = data.patient_id;
});

afterAll(removeAll);

/** A bill of typed lines — the owner gives discounts — with the totals the formula works out. */
function aBill(lines: BillLine[], discount: BillDiscount | null) {
  const totals = billTotals(lines, discount);
  return {
    totals,
    bill: {
      patient_id: patientId,
      items: lines.map((line, index) => ({
        description: `Line ${index + 1}`,
        quantity: line.quantity,
        unit_price_paise: line.unitPricePaise,
      })),
      subtotal_paise: totals.subtotal,
      discount_paise: totals.discount,
      total_paise: totals.total,
    },
  };
}

const issue = (bill: Record<string, unknown>) =>
  clinic.owner.tenant.supabase.rpc("create_bill", { p_bill: bill, p_idempotency_key: randomUUID() });

describe("billTotals and create_bill (plan §15.1)", () => {
  it.each([
    ["no discount", [{ quantity: 2, unitPricePaise: 15_025 }], null],
    ["an amount off", [{ quantity: 1, unitPricePaise: 50_000 }], { kind: "AMOUNT", paise: 7_550 }],
    ["15% of ₹333, ₹50 off", [{ quantity: 1, unitPricePaise: 33_300 }], { kind: "PERCENT", percent: 15 }],
    ["10% of ₹333.50, ₹33 off", [{ quantity: 1, unitPricePaise: 33_350 }], { kind: "PERCENT", percent: 10 }],
    ["1% of ₹450, half up to ₹5", [{ quantity: 3, unitPricePaise: 15_000 }], { kind: "PERCENT", percent: 1 }],
    ["100% of ₹333.50, all of it", [{ quantity: 1, unitPricePaise: 33_350 }], { kind: "PERCENT", percent: 100 }],
    [
      "several lines, 12% off",
      [
        { quantity: 1, unitPricePaise: 80_000 },
        { quantity: 4, unitPricePaise: 1_299 },
        { quantity: 1, unitPricePaise: 0 },
      ],
      { kind: "PERCENT", percent: 12 },
    ],
  ] as const)("issues %s at the totals the formula works out", async (_, lines, discount) => {
    const { bill, totals } = aBill([...lines], discount);
    const { data, error } = await issue(bill);
    expect(error).toBeNull();
    expect((data as { total_paise: number }).total_paise).toBe(totals.total);
  });

  it("refuses a total a paisa off, and a discount past the subtotal, as the last word (D293)", async () => {
    const { bill } = aBill([{ quantity: 1, unitPricePaise: 33_300 }], { kind: "PERCENT", percent: 15 });
    expect((await issue({ ...bill, total_paise: bill.total_paise + 1 })).error?.hint).toBe("VALIDATION_ERROR");
    expect((await issue({ ...bill, subtotal_paise: bill.subtotal_paise - 1 })).error?.hint).toBe("VALIDATION_ERROR");

    const over = aBill([{ quantity: 1, unitPricePaise: 50_000 }], { kind: "AMOUNT", paise: 60_000 });
    expect(over.totals.total).toBeLessThan(0);
    expect((await issue(over.bill)).error?.hint).toBe("VALIDATION_ERROR");
  });
});
