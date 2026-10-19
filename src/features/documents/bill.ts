import { UI_TEXT } from "@/constants/messages";
import { GENDER_LABELS } from "@/constants/statuses";
import { balanceWords } from "@/features/billing/form";
import { formatAge } from "@/lib/format/age";
import { formatPaise } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { composer, leading, type Measure, type PdfLayout, type TextStyle } from "@/lib/pdf/layout";
import { layoutLetterhead } from "@/lib/pdf/letterhead";
import { PDF_INNER } from "@/lib/pdf/render";
import { formatPhoneDigits } from "@/lib/phone";

import type { BillSheet, BillSource } from "./types";

const { documents: words, patients: patientWords, fields } = UI_TEXT;

/**
 * A bill in the words it is printed in (plan §15.5; D315, D316): the
 * letterhead with the GSTIN, when the clinic has one; the number and the
 * day; the patient — their age on that day — their mobile and the doctor;
 * the lines; the subtotal, the discount, the total, and what is paid and
 * due on it; the patient's balance; the notes. A void bill says why, and
 * holds no payment.
 */
export function billSheet(source: BillSource, { logo }: { logo: boolean }): BillSheet {
  const { clinic, bill } = source;
  const { settlement } = bill;
  return {
    letterhead: {
      name: clinic.name,
      address: clinic.address,
      city: clinic.city,
      phone: clinic.phone,
      gstin: clinic.gstin,
      logo,
    },
    number: words.billNumber(bill.number),
    date: formatDate(bill.issuedOn),
    patient: bill.patient.name,
    about: [
      formatAge(bill.patient.dateOfBirth, bill.issuedOn),
      GENDER_LABELS[bill.patient.gender],
      patientWords.number(bill.patient.number),
    ].join(" · "),
    contact: [
      words.mobile(`${fields.phonePrefix} ${formatPhoneDigits(bill.patient.phone)}`),
      bill.doctor && words.doctor(bill.doctor),
    ]
      .filter(Boolean)
      .join(" · "),
    lines: bill.lines.map((line) => ({
      description: line.description,
      quantity: String(line.quantity),
      rate: formatPaise(line.unitPricePaise),
      amount: formatPaise(line.amountPaise),
    })),
    figures: [
      { label: words.subtotal, value: formatPaise(bill.subtotalPaise) },
      ...(bill.discountPaise > 0 ? [{ label: words.discount, value: `−${formatPaise(bill.discountPaise)}` }] : []),
      { label: words.total, value: formatPaise(bill.totalPaise), lead: true },
      ...(settlement
        ? [
            { label: words.paid, value: formatPaise(settlement.paidPaise) },
            { label: words.due, value: formatPaise(settlement.duePaise) },
          ]
        : []),
    ],
    balance: bill.void ? null : words.balance(balanceWords(bill.balancePaise)),
    notes: bill.notes,
    void: bill.void && words.voidReason(bill.void.reason),
    signatory: clinic.name,
  };
}

const style = (face: TextStyle["face"], size: number, color: TextStyle["color"] = "ink"): TextStyle => ({
  face,
  size,
  color,
});

/** Where each column ends: the amount at the right edge, the rate and the quantity before it. */
const RATE_END = PDF_INNER - 72;
const QUANTITY_END = RATE_END - 70;
/** How wide a line's description runs, clear of the quantity. */
const DESCRIPTION = QUANTITY_END - 40;
/** Where the figures' names start. */
const FIGURES = PDF_INNER - 170;
/** The signature's line. */
const SIGNATURE = 130;

/**
 * Where everything on the bill goes (plan §15.5): the clinic across the top;
 * "Bill" with the day on the right, the number under it — and why it is void;
 * the patient, their mobile and doctor; the lines as a table — description,
 * quantity, rate and amount — the figures under it at the right; the
 * balance and the notes. The signature — the clinic's, as its authorised
 * signatory (D316) — stands at the foot of the last page. A page may end
 * only between lines, or before the figures. A void bill has VOID across
 * every page (D315).
 */
export function layoutBill(sheet: BillSheet, measure: Measure): PdfLayout {
  const page = composer(measure, PDF_INNER);
  /** Text set to end at `end`, on the current line. */
  const endAt = (text: string, textStyle: TextStyle, end: number) =>
    page.mark(text, textStyle, { x: end - measure(text, textStyle.face, textStyle.size) });

  layoutLetterhead(page, sheet.letterhead);
  page.space(10);
  page.row({ text: words.bill, style: style("bold", 13) }, { text: sheet.date, style: style("regular", 8.5) });
  page.text(sheet.number, style("semibold", 9));
  if (sheet.void) page.text(sheet.void, style("semibold", 9));
  page.space(8);
  page.rule();
  page.space(9);
  page.pair(
    { text: sheet.patient, style: style("semibold", 10) },
    { text: sheet.about, style: style("regular", 8.5, "muted") },
    { gap: 6 },
  );
  page.text(sheet.contact, style("regular", 8, "muted"));
  page.space(12);
  page.mayBreak();

  const head = style("semibold", 7.5, "muted");
  const { billColumns: columns } = words;
  page.mark(columns.description, head);
  endAt(columns.quantity, head, QUANTITY_END);
  endAt(columns.rate, head, RATE_END);
  endAt(columns.amount, head, PDF_INNER);
  page.space(leading(head.size) + 2);
  page.rule();
  page.space(5);
  const body = style("regular", 8.5);
  for (const line of sheet.lines) {
    endAt(line.quantity, body, QUANTITY_END);
    endAt(line.rate, body, RATE_END);
    endAt(line.amount, body, PDF_INNER);
    page.text(line.description, body, { wide: DESCRIPTION });
    page.space(3);
    page.mayBreak();
  }
  page.space(2);
  page.rule();
  page.space(6);

  for (const figure of sheet.figures) {
    const figureStyle = figure.lead ? style("bold", 10) : style("regular", 8.5);
    page.mark(figure.label, figureStyle, { x: FIGURES });
    endAt(figure.value, figureStyle, PDF_INNER);
    page.space(leading(figureStyle.size) + 1);
  }
  page.mayBreak();
  if (sheet.balance) {
    page.space(8);
    page.text(sheet.balance, style("semibold", 8.5));
    page.mayBreak();
  }
  if (sheet.notes) {
    page.space(8);
    page.text(words.notes, style("semibold", 8.5));
    page.text(sheet.notes, style("regular", 8.5));
    page.mayBreak();
  }

  const foot = composer(measure, PDF_INNER);
  foot.space(24);
  foot.rule({ x: PDF_INNER - SIGNATURE, wide: SIGNATURE, color: "ink" });
  foot.space(4);
  foot.mark(sheet.signatory, style("semibold", 8.5), { right: true });
  foot.space(leading(8.5));
  foot.mark(words.signatory, style("regular", 7.5, "muted"), { right: true });
  foot.space(12);

  const { height, ops, breaks } = page.done();
  const signature = foot.done();
  return {
    height,
    ops,
    breaks,
    foot: { height: signature.height, ops: signature.ops },
    running: words.running(sheet.patient, sheet.number, sheet.date),
    ...(sheet.void && { stamp: words.voidStamp }),
  };
}
