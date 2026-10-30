// @vitest-environment node
import { describe, expect, it } from "vitest";

import { layoutReceipt, periodOf, receiptSheet } from "@/features/documents/receipt";
import type { ReceiptSource } from "@/features/documents/types";
import type { Measure, PdfOp } from "@/lib/pdf/layout";

/** Half the size a character, whatever the face. */
const measure: Measure = (text, _face, size) => text.length * size * 0.5;
const said = (ops: PdfOp[]) => ops.flatMap((op) => (op.kind === "text" ? [op.text] : []));

/** A month paid early by UPI: the plan ran to 12 Nov, recorded on 30 Oct (IST). */
const aReceipt = (overrides: Partial<ReceiptSource> = {}): ReceiptSource => ({
  receiptNumber: "R/2026-27/0001",
  kind: "MONTHLY",
  amountPaise: 30_000,
  method: "UPI",
  reference: "UPI-4821",
  paidOn: "2026-10-30",
  validFrom: "2026-11-12",
  validUntil: "2026-12-12",
  recordedAt: "2026-10-30T05:00:00.000Z",
  clinic: { name: "Smile Care Dental", city: "Kochi" },
  owner: "Asha Menon",
  business: { name: "ClinicDesk Software", address: "12 MG Road\n Kochi 682001 \n" },
  ...overrides,
});

describe("periodOf (plan §7.4)", () => {
  it("runs from the day after the plan's last day when paid early", () => {
    expect(periodOf(aReceipt())).toBe("13 Nov 2026 – 12 Dec 2026");
  });

  it("runs from the day it was recorded when paid late", () => {
    expect(periodOf(aReceipt({ validFrom: "2026-09-01", validUntil: "2026-11-29" }))).toBe("30 Oct 2026 – 29 Nov 2026");
  });

  it("says only the last day of a date set earlier than that", () => {
    expect(periodOf(aReceipt({ kind: "CUSTOM", validFrom: "2026-12-12", validUntil: "2026-11-01" }))).toBe(
      "Until 1 Nov 2026",
    );
  });
});

describe("receiptSheet (plan §7.5; D392)", () => {
  it("says who received what from whom, for what, and how it was paid", () => {
    expect(receiptSheet(aReceipt())).toEqual({
      business: { name: "ClinicDesk Software", address: ["12 MG Road", "Kochi 682001"] },
      number: "R/2026-27/0001",
      date: "30 Oct 2026",
      from: ["Smile Care Dental, Kochi", "Asha Menon"],
      forWhat: ["Monthly plan", "13 Nov 2026 – 12 Dec 2026"],
      amount: "₹300",
      paid: "Paid by UPI · UPI-4821 · 30 Oct 2026",
    });
  });

  it("heads it with the app's own name while the business details are unset, and leaves out no reference", () => {
    const sheet = receiptSheet(
      aReceipt({ business: { name: null, address: null }, reference: null, kind: "YEARLY", method: "CASH" }),
    );
    expect(sheet.business).toEqual({ name: "ClinicDesk", address: [] });
    expect(sheet.forWhat[0]).toBe("Yearly plan");
    expect(sheet.paid).toBe("Paid by Cash · 30 Oct 2026");
    expect(receiptSheet(aReceipt({ kind: "CUSTOM" })).forWhat[0]).toBe("Plan, to a date set");
  });
});

describe("layoutReceipt (D392)", () => {
  it("lays it out top to bottom on one page: the business, the receipt, who, what, the amount, the foot", () => {
    const layout = layoutReceipt(receiptSheet(aReceipt()), measure);
    expect(said(layout.ops)).toEqual([
      "ClinicDesk Software",
      "12 MG Road",
      "Kochi 682001",
      // A row sets its right-hand text first, so the left wraps clear of it.
      "R/2026-27/0001",
      "Receipt",
      "30 Oct 2026",
      "Received from",
      "Smile Care Dental, Kochi",
      "Asha Menon",
      "For",
      "Monthly plan",
      "13 Nov 2026 – 12 Dec 2026",
      "₹300",
      "Amount",
      "Paid by UPI · UPI-4821 · 30 Oct 2026",
      "A receipt for a plan payment; not a tax invoice.",
    ]);
    expect(layout).toMatchObject({ foot: null, running: null });
    expect(layout.height).toBeGreaterThan(0);
  });
});
