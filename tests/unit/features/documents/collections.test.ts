// @vitest-environment node
import { describe, expect, it } from "vitest";

import { collectionsSheet, layoutCollections } from "@/features/documents/collections";
import type { CollectionsSource } from "@/features/documents/types";
import type { Collection } from "@/features/reports/types";
import type { Measure, PdfOp } from "@/lib/pdf/layout";
import { PDF_INNER } from "@/lib/pdf/render";
import { aDailyReport } from "@tests/support/reports";

/** Half the size a character, whatever the face. */
const measure: Measure = (text, _face, size) => text.length * size * 0.5;
const texts = (ops: PdfOp[]) => ops.flatMap((op) => (op.kind === "text" ? [op] : []));
const said = (ops: PdfOp[]) => texts(ops).map((op) => op.text);

const COLLECTIONS: Collection[] = [
  {
    receivedBy: "user-1",
    receiverName: "Asha Menon",
    method: "CASH",
    payments: 0,
    receivedPaise: 0,
    refunds: 1,
    refundedPaise: 20_000,
  },
  {
    receivedBy: null,
    receiverName: null,
    method: "UPI",
    payments: 1,
    receivedPaise: 100_000,
    refunds: 0,
    refundedPaise: 0,
  },
];

const aSource = (changes: Parameters<typeof aDailyReport>[0] = {}): CollectionsSource => ({
  clinic: { name: "Smile Care", address: "12 MG Road", city: "Kochi", phone: "0484 234 5678", paperSize: "A5" },
  report: aDailyReport({
    collections: COLLECTIONS,
    voided: { payments: 1, paymentPaise: 30_000, refunds: 0, refundPaise: 0 },
    ...changes,
  }),
});

describe("collectionsSheet (plan §18; D357 – D359)", () => {
  it("puts the day's collections in the words they are printed in", () => {
    expect(collectionsSheet(aSource(), { logo: true })).toEqual({
      letterhead: { name: "Smile Care", address: "12 MG Road", city: "Kochi", phone: "0484 234 5678", logo: true },
      date: "Tuesday, 27 Oct 2026",
      people: [
        { name: "Asha Menon", lines: [{ label: "Refunded, Cash", value: "−₹200" }], handOver: "−₹200" },
        { name: "No longer on the team", lines: [{ label: "UPI", value: "₹1,000" }], handOver: "₹0" },
      ],
      methods: [
        { label: "Cash", received: "₹0", refunded: "₹200", net: "−₹200" },
        { label: "UPI", received: "₹1,000", refunded: "₹0", net: "₹1,000" },
      ],
      net: "₹800",
      voided: "Voided: 1 payment, ₹300",
    });
  });
});

describe("layoutCollections (plan §18; D358 – D360)", () => {
  const sheet = collectionsSheet(aSource(), { logo: false });

  it("lays out the clinic, the day, each person and the cash they hand over, each method, the net and the voids", () => {
    const layout = layoutCollections(sheet, measure);
    const lines = said(layout.ops);
    for (const line of [
      "Smile Care",
      "Day-end collections",
      "Tuesday, 27 Oct 2026",
      "By person",
      "Asha Menon",
      "Refunded, Cash",
      "Cash to hand over",
      "No longer on the team",
      "By method",
      "Method",
      "Received",
      "Refunded",
      "Net",
      "Net collected",
      "₹800",
      "Voided: 1 payment, ₹300",
    ]) {
      expect(lines, line).toContain(line);
    }
    // Each value set to end at its column; the net at the right edge.
    const op = (text: string) => texts(layout.ops).find((each) => each.text === text)!;
    const endOf = (each: ReturnType<typeof op>) => each.x + measure(each.text, each.face, each.size);
    expect(endOf(op("₹800"))).toBeCloseTo(PDF_INNER);
    expect(op("Cash to hand over").face).toBe("bold");
    expect(layout.running).toBe("Day-end collections · Tuesday, 27 Oct 2026");
    // A page may end after each person, and after the table.
    expect(layout.breaks).toHaveLength(3);
  });

  it("is signed over at the foot: Counted by, Received by (D360)", () => {
    const { foot } = layoutCollections(sheet, measure);
    const rules = foot!.ops.filter((op) => op.kind === "rule");
    expect(rules.map((rule) => rule.x)).toEqual([0, PDF_INNER - 140]);
    expect(said(foot!.ops)).toEqual(["Counted by", "Received by"]);
  });

  it("says so on a day with no payments, and leaves out voids when there are none", () => {
    const empty = collectionsSheet(
      aSource({ collections: [], voided: { payments: 0, paymentPaise: 0, refunds: 0, refundPaise: 0 } }),
      {
        logo: false,
      },
    );
    const lines = said(layoutCollections(empty, measure).ops);
    expect(lines).toContain("No payments this day.");
    expect(lines).not.toContain("By method");
    const quiet = collectionsSheet(aSource({ voided: { payments: 0, paymentPaise: 0, refunds: 0, refundPaise: 0 } }), {
      logo: false,
    });
    expect(said(layoutCollections(quiet, measure).ops).some((line) => line.startsWith("Voided"))).toBe(false);
  });
});
