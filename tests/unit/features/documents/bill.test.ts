// @vitest-environment node
import { describe, expect, it } from "vitest";

import { UI_TEXT } from "@/constants/messages";
import type { BillDetail } from "@/features/billing/types";
import { billSheet, layoutBill } from "@/features/documents/bill";
import type { BillSheet, BillSource } from "@/features/documents/types";
import type { Measure, PdfOp } from "@/lib/pdf/layout";
import { PDF_INNER } from "@/lib/pdf/render";

const { documents: words } = UI_TEXT;

/** Half the size a character, whatever the face: wide enough to wrap, simple enough to count. */
const measure: Measure = (text, _face, size) => text.length * size * 0.5;

const aBill = (changes: Partial<BillDetail> = {}): BillDetail => ({
  id: "b-1",
  number: "2026-27/0042",
  issuedAt: "2020-01-14T05:30:00Z",
  issuedOn: "2020-01-14",
  status: "ISSUED",
  patient: {
    id: "p-1",
    name: "Rohan Mehta",
    number: 1002,
    phone: "+919876543210",
    dateOfBirth: "1990-06-15",
    gender: "MALE",
    archived: false,
  },
  visitId: "v-1",
  appointmentId: null,
  doctor: "Maya Rao",
  lines: [
    {
      description: "Consultation",
      quantity: 1,
      unitPricePaise: 80_000,
      amountPaise: 80_000,
      serviceId: "s-1",
      treatmentId: null,
    },
    {
      description: "Dressing kit",
      quantity: 3,
      unitPricePaise: 4_000,
      amountPaise: 12_000,
      serviceId: null,
      treatmentId: null,
    },
  ],
  subtotalPaise: 92_000,
  discountPaise: 2_000,
  totalPaise: 90_000,
  notes: "Paid by his son",
  issuedBy: "Priya Shah",
  void: null,
  settlement: { paidPaise: 50_000, duePaise: 40_000, state: "PART_PAID" },
  balancePaise: 40_000,
  ...changes,
});

const aSource = (bill: BillDetail = aBill(), gstin: string | null = "32ABCDE1234F1Z5"): BillSource => ({
  clinic: { name: "Smile Care", address: "12 MG Road", city: "Kochi", phone: "0484 234 5678", gstin, paperSize: "A5" },
  bill,
});

const texts = (ops: PdfOp[]) => ops.flatMap((op) => (op.kind === "text" ? [op] : []));
const said = (ops: PdfOp[]) => texts(ops).map((op) => op.text);
const sheetOf = (changes: Partial<BillSheet> = {}): BillSheet => ({
  ...billSheet(aSource(), { logo: false }),
  ...changes,
});

describe("billSheet (plan §15.5)", () => {
  it("puts the bill in the words it is printed in", () => {
    expect(billSheet(aSource(), { logo: true })).toEqual({
      letterhead: {
        name: "Smile Care",
        address: "12 MG Road",
        city: "Kochi",
        phone: "0484 234 5678",
        gstin: "32ABCDE1234F1Z5",
        logo: true,
      },
      number: "No. 2026-27/0042",
      date: "14 Jan 2020",
      patient: "Rohan Mehta",
      // Their age on the bill's day.
      about: "29 y · Male · P-1002",
      contact: "Mobile +91 98765 43210 · Dr. Maya Rao",
      lines: [
        { description: "Consultation", quantity: "1", rate: "₹800", amount: "₹800" },
        { description: "Dressing kit", quantity: "3", rate: "₹40", amount: "₹120" },
      ],
      figures: [
        { label: words.subtotal, value: "₹920" },
        { label: words.discount, value: "−₹20" },
        { label: words.total, value: "₹900", lead: true },
        { label: words.paid, value: "₹500" },
        { label: words.due, value: "₹400" },
      ],
      balance: words.balance("₹400 due"),
      notes: "Paid by his son",
      void: null,
      signatory: "Smile Care",
    });
  });

  it("leaves out a discount of nothing, a doctor not named, and a GSTIN the clinic has not given", () => {
    const sheet = billSheet(aSource(aBill({ discountPaise: 0, doctor: null }), null), { logo: false });
    expect(sheet.figures.map((figure) => figure.label)).not.toContain(words.discount);
    expect(sheet.contact).toBe("Mobile +91 98765 43210");
    expect(sheet.letterhead.gstin).toBeNull();
  });

  it("says why a void bill is, with no payment on it and no balance (D315)", () => {
    const sheet = billSheet(
      aSource(
        aBill({
          status: "VOID",
          void: { reason: "Wrong patient", at: "2020-01-15T05:00:00Z", by: null },
          settlement: null,
        }),
      ),
      { logo: false },
    );
    expect(sheet.void).toBe("Void: Wrong patient");
    expect(sheet.figures.map((figure) => figure.label)).toEqual([words.subtotal, words.discount, words.total]);
    expect(sheet.balance).toBeNull();
  });
});

describe("layoutBill (plan §15.5; D315, D316)", () => {
  it("lays out the clinic, Bill with its day and number, the patient, the lines as a table, the figures, balance and notes", () => {
    const layout = layoutBill(sheetOf(), measure);
    const lines = said(layout.ops);
    expect(lines.slice(0, 4)).toEqual(["Smile Care", "12 MG Road, Kochi", "0484 234 5678", "GSTIN 32ABCDE1234F1Z5"]);
    for (const line of [
      words.bill,
      "14 Jan 2020",
      "No. 2026-27/0042",
      "Rohan Mehta",
      "29 y · Male · P-1002",
      "Mobile +91 98765 43210 · Dr. Maya Rao",
      ...Object.values(words.billColumns),
      "Consultation",
      "₹800",
      "Dressing kit",
      "₹40",
      "₹120",
      words.total,
      "₹900",
      words.due,
      "₹400",
      words.balance("₹400 due"),
      words.notes,
      "Paid by his son",
    ]) {
      expect(lines).toContain(line);
    }
    const op = (text: string) => texts(layout.ops).find((each) => each.text === text)!;
    const endOf = (each: ReturnType<typeof op>) => each.x + measure(each.text, each.face, each.size);
    // The day at the right edge on Bill's line; each line's amount at the right edge, on its description's line.
    expect(op("14 Jan 2020").y).toBe(op(words.bill).y);
    expect(endOf(op("14 Jan 2020"))).toBeCloseTo(PDF_INNER);
    expect(op("₹120").y).toBe(op("Dressing kit").y);
    expect(endOf(op("₹120"))).toBeCloseTo(PDF_INNER);
    expect(endOf(op(words.billColumns.amount))).toBeCloseTo(PDF_INNER);
    // The quantity and the rate stand in their columns, before the amount.
    expect(op("3").x).toBeLessThan(op("₹40").x);
    expect(op("₹40").x).toBeLessThan(op("₹120").x);
    // The total is set larger, its name beside its value.
    expect(op(words.total).size).toBeGreaterThan(op(words.subtotal).size);
    expect(op("₹900").y).toBe(op(words.total).y);
    expect(lines.indexOf("Dressing kit")).toBeLessThan(lines.indexOf(words.subtotal));
    expect(layout.running).toBe(words.running("Rohan Mehta", "No. 2026-27/0042", "14 Jan 2020"));
    expect(layout.stamp).toBeUndefined();
  });

  it("may end a page after the patient, after each line, after the figures, the balance and the notes", () => {
    const full = layoutBill(sheetOf(), measure);
    expect(full.breaks).toHaveLength(1 + 2 + 1 + 1 + 1);
    expect([...full.breaks].sort((a, b) => a - b)).toEqual(full.breaks);
    expect(full.breaks.at(-1)).toBe(full.height);
    expect(layoutBill(sheetOf({ balance: null, notes: null }), measure).breaks).toHaveLength(1 + 2 + 1);
  });

  it("is signed at the foot by the clinic, as its authorised signatory (D316)", () => {
    const { foot } = layoutBill(sheetOf(), measure);
    const rule = foot!.ops.find((op) => op.kind === "rule")!;
    expect(rule).toMatchObject({ x: PDF_INNER - 130, width: 130, color: "ink" });
    const [clinic, signatory] = texts(foot!.ops);
    expect([clinic.text, signatory.text]).toEqual(["Smile Care", words.signatory]);
    expect(clinic.x + measure(clinic.text, clinic.face, clinic.size)).toBeCloseTo(PDF_INNER);
    expect(signatory.y).toBeGreaterThan(clinic.y);
  });

  it("has VOID across a void bill, and says why under its number (D315)", () => {
    const layout = layoutBill(sheetOf({ void: "Void: Wrong patient", balance: null }), measure);
    expect(layout.stamp).toBe(words.voidStamp);
    const lines = said(layout.ops);
    expect(lines.indexOf("Void: Wrong patient")).toBe(lines.indexOf("No. 2026-27/0042") + 1);
  });
});
