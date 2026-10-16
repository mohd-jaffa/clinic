import { describe, expect, it } from "vitest";

import { billTotals, discountPaise, lineAmount } from "@/features/billing/totals";

/** ₹ as paise, to keep the cases readable. */
const rupees = (amount: number) => Math.round(amount * 100);

describe("lineAmount", () => {
  it("is the quantity times the price, in paise", () => {
    expect(lineAmount({ quantity: 3, unitPricePaise: rupees(499.5) })).toBe(rupees(1498.5));
    expect(lineAmount({ quantity: 1, unitPricePaise: 0 })).toBe(0);
  });
});

describe("discountPaise (D290 – D293)", () => {
  it("is nothing without a discount", () => {
    expect(discountPaise(rupees(500), null)).toBe(0);
  });

  it("stands as typed when given as an amount, even past the subtotal (the form refuses that, D293)", () => {
    expect(discountPaise(rupees(500), { kind: "AMOUNT", paise: rupees(50) })).toBe(rupees(50));
    expect(discountPaise(rupees(500), { kind: "AMOUNT", paise: rupees(600) })).toBe(rupees(600));
  });

  it("takes a percentage of the subtotal to the nearest rupee, half up (D290)", () => {
    // 15% of ₹333 is ₹49.95: ₹50 off.
    expect(discountPaise(rupees(333), { kind: "PERCENT", percent: 15 })).toBe(rupees(50));
    // 10% of ₹333.50 is ₹33.35: ₹33 off.
    expect(discountPaise(rupees(333.5), { kind: "PERCENT", percent: 10 })).toBe(rupees(33));
    // 1% of ₹450 is ₹4.50 exactly: half a rupee rounds up.
    expect(discountPaise(rupees(450), { kind: "PERCENT", percent: 1 })).toBe(rupees(5));
    // 1% of ₹449.99 is ₹4.4999: down.
    expect(discountPaise(rupees(449.99), { kind: "PERCENT", percent: 1 })).toBe(rupees(4));
    expect(discountPaise(rupees(1500), { kind: "PERCENT", percent: 20 })).toBe(rupees(300));
  });

  it("never takes off more than the subtotal: 100% is the whole of it, paise and all", () => {
    expect(discountPaise(rupees(333.5), { kind: "PERCENT", percent: 100 })).toBe(rupees(333.5));
    // 99% of ₹333.50 is ₹330.165: ₹330 off, under it.
    expect(discountPaise(rupees(333.5), { kind: "PERCENT", percent: 99 })).toBe(rupees(330));
    expect(discountPaise(0, { kind: "PERCENT", percent: 50 })).toBe(0);
  });

  it("works in integers at the largest bill without drifting", () => {
    expect(discountPaise(100_000_000, { kind: "PERCENT", percent: 33 })).toBe(33_000_000);
    expect(discountPaise(99_999_999, { kind: "PERCENT", percent: 33 })).toBe(33_000_000);
  });
});

describe("billTotals (plan §15.1)", () => {
  const lines = [
    { quantity: 1, unitPricePaise: rupees(500) },
    { quantity: 2, unitPricePaise: rupees(150.25) },
  ];

  it("adds up the lines and takes off the discount", () => {
    expect(billTotals(lines, null)).toEqual({ subtotal: rupees(800.5), discount: 0, total: rupees(800.5) });
    expect(billTotals(lines, { kind: "AMOUNT", paise: rupees(100) })).toEqual({
      subtotal: rupees(800.5),
      discount: rupees(100),
      total: rupees(700.5),
    });
    // 10% of ₹800.50 is ₹80.05: ₹80 off.
    expect(billTotals(lines, { kind: "PERCENT", percent: 10 })).toEqual({
      subtotal: rupees(800.5),
      discount: rupees(80),
      total: rupees(720.5),
    });
  });

  it("comes to nothing for no lines, and to nothing at 100%", () => {
    expect(billTotals([], null)).toEqual({ subtotal: 0, discount: 0, total: 0 });
    expect(billTotals(lines, { kind: "PERCENT", percent: 100 }).total).toBe(0);
  });

  it("shows a discount past the subtotal as a total below nothing, for the form to refuse (D293)", () => {
    expect(billTotals(lines, { kind: "AMOUNT", paise: rupees(900) }).total).toBe(rupees(-99.5));
  });
});
