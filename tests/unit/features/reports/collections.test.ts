import { describe, expect, it } from "vitest";

import { dayEndOf, personLines, signedPaise, voidedLine } from "@/features/reports/collections";
import type { Collection } from "@/features/reports/types";
import { aDailyReport } from "@tests/support/reports";

const taken = (changes: Partial<Collection>): Collection => ({
  receivedBy: "user-2",
  receiverName: "Priya Nair",
  method: "CASH",
  payments: 1,
  receivedPaise: 0,
  refunds: 0,
  refundedPaise: 0,
  ...changes,
});

/** As report_daily gives it: a row a person and a method, by name, someone no longer here last. */
const COLLECTIONS: Collection[] = [
  taken({ receivedBy: "user-1", receiverName: "Asha Menon", method: "CARD", receivedPaise: 50_000 }),
  taken({
    receivedBy: "user-1",
    receiverName: "Asha Menon",
    method: "CASH",
    payments: 0,
    refunds: 1,
    refundedPaise: 20_000,
  }),
  taken({ method: "UPI", receivedPaise: 100_000 }),
  taken({ method: "CASH", payments: 2, receivedPaise: 230_000 }),
  taken({ receivedBy: null, receiverName: null, method: "CASH", receivedPaise: 10_000 }),
];

describe("dayEndOf (plan §18; D49, D357, D358)", () => {
  it("gathers each person's methods in the app's order, and the cash each hands over", () => {
    const { people } = dayEndOf(aDailyReport({ collections: COLLECTIONS }));
    expect(people).toEqual([
      {
        receivedBy: "user-1",
        name: "Asha Menon",
        methods: [
          { method: "CASH", receivedPaise: 0, refundedPaise: 20_000 },
          { method: "CARD", receivedPaise: 50_000, refundedPaise: 0 },
        ],
        // Cash only (D357): the card payment went to the clinic's account.
        cashPaise: -20_000,
      },
      {
        receivedBy: "user-2",
        name: "Priya Nair",
        methods: [
          { method: "CASH", receivedPaise: 230_000, refundedPaise: 0 },
          { method: "UPI", receivedPaise: 100_000, refundedPaise: 0 },
        ],
        cashPaise: 230_000,
      },
      {
        receivedBy: null,
        name: null,
        methods: [{ method: "CASH", receivedPaise: 10_000, refundedPaise: 0 }],
        cashPaise: 10_000,
      },
    ]);
  });

  it("totals each method used, in the app's order, and the day's net", () => {
    const report = aDailyReport({
      collections: COLLECTIONS,
      voided: { payments: 1, paymentPaise: 30_000, refunds: 0, refundPaise: 0 },
    });
    expect(dayEndOf(report)).toMatchObject({
      methods: [
        { method: "CASH", receivedPaise: 240_000, refundedPaise: 20_000, netPaise: 220_000 },
        { method: "UPI", receivedPaise: 100_000, refundedPaise: 0, netPaise: 100_000 },
        { method: "CARD", receivedPaise: 50_000, refundedPaise: 0, netPaise: 50_000 },
      ],
      netPaise: 370_000,
      voided: { payments: 1, paymentPaise: 30_000 },
    });
  });

  it("is nothing on a day with no money", () => {
    expect(dayEndOf(aDailyReport({ collections: [] }))).toMatchObject({ people: [], methods: [], netPaise: 0 });
  });
});

describe("personLines (D358)", () => {
  it("says what a person took by each method, then what they handed back", () => {
    const [asha] = dayEndOf(aDailyReport({ collections: COLLECTIONS })).people;
    expect(personLines(asha)).toEqual([
      { label: "Card", value: "₹500" },
      { label: "Refunded, Cash", value: "−₹200" },
    ]);
  });
});

describe("signedPaise", () => {
  it("writes an amount below nothing with the printer's own minus", () => {
    expect([20_000, 0, -20_000].map(signedPaise)).toEqual(["₹200", "₹0", "−₹200"]);
  });
});

describe("voidedLine", () => {
  it("says what was voided of the day, payments and refunds, or nothing", () => {
    expect(voidedLine({ payments: 1, paymentPaise: 50_000, refunds: 0, refundPaise: 0 })).toBe(
      "Voided: 1 payment, ₹500",
    );
    expect(voidedLine({ payments: 2, paymentPaise: 80_000, refunds: 1, refundPaise: 20_000 })).toBe(
      "Voided: 2 payments, ₹800 · 1 refund, ₹200",
    );
    expect(voidedLine({ payments: 0, paymentPaise: 0, refunds: 3, refundPaise: 30_000 })).toBe(
      "Voided: 3 refunds, ₹300",
    );
    expect(voidedLine({ payments: 0, paymentPaise: 0, refunds: 0, refundPaise: 0 })).toBeNull();
  });
});
