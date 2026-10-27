import { UI_TEXT } from "@/constants/messages";
import { PAYMENT_METHOD_LABELS } from "@/constants/statuses";
import { dayEndOf, personLines, signedPaise, voidedLine } from "@/features/reports/collections";
import { formatPaise } from "@/lib/format/currency";
import { formatLongDate } from "@/lib/format/date";
import { composer, leading, type Measure, type PdfLayout, type TextStyle } from "@/lib/pdf/layout";
import { layoutLetterhead } from "@/lib/pdf/letterhead";
import { PDF_INNER } from "@/lib/pdf/render";

import type { CollectionsSheet, CollectionsSource } from "./types";

const { documents: words, reports } = UI_TEXT;

/**
 * The day-end collections in the words they are printed in (plan §18; D49,
 * D357 – D360): the letterhead; the day; each person who took money — what
 * they took and handed back by each method, and the cash they hand over;
 * each method's received, refunded and net; the day's net, and its voids.
 */
export function collectionsSheet(source: CollectionsSource, { logo }: { logo: boolean }): CollectionsSheet {
  const { clinic, report } = source;
  const dayEnd = dayEndOf(report);
  return {
    letterhead: { name: clinic.name, address: clinic.address, city: clinic.city, phone: clinic.phone, logo },
    date: formatLongDate(report.day),
    people: dayEnd.people.map((person) => ({
      name: person.name ?? reports.formerMember,
      lines: personLines(person),
      handOver: signedPaise(person.cashPaise),
    })),
    methods: dayEnd.methods.map((method) => ({
      label: PAYMENT_METHOD_LABELS[method.method],
      received: formatPaise(method.receivedPaise),
      refunded: formatPaise(method.refundedPaise),
      net: signedPaise(method.netPaise),
    })),
    net: signedPaise(dayEnd.netPaise),
    voided: voidedLine(dayEnd.voided),
  };
}

const style = (face: TextStyle["face"], size: number, color: TextStyle["color"] = "ink"): TextStyle => ({
  face,
  size,
  color,
});

/** Where each method's columns end: net at the right edge, refunded and received before it. */
const REFUNDED_END = PDF_INNER - 80;
const RECEIVED_END = REFUNDED_END - 80;
/** How far a person's lines stand in from their name. */
const INDENT = 10;
/** Each sign-off's line. */
const SIGN = 140;

/**
 * Where everything on the day-end collections goes (D358 – D360): the clinic
 * across the top; "Day-end collections" with the day on the right; by
 * person — each name, their lines set to the right, and the cash they hand
 * over in bold; by method as a table; the day's net, and its voids. Two
 * sign-off lines at the foot of the last page — Counted by, Received by
 * (D360). A page may end only between people, or before the table.
 */
export function layoutCollections(sheet: CollectionsSheet, measure: Measure): PdfLayout {
  const page = composer(measure, PDF_INNER);
  const endAt = (text: string, textStyle: TextStyle, end: number) =>
    page.mark(text, textStyle, { x: end - measure(text, textStyle.face, textStyle.size) });
  /** A label and its value set to the right edge, on one line. */
  const line = (label: string, value: string, textStyle: TextStyle, x = 0) => {
    page.mark(label, textStyle, { x });
    endAt(value, textStyle, PDF_INNER);
    page.space(leading(textStyle.size));
  };

  layoutLetterhead(page, sheet.letterhead);
  page.space(10);
  page.row({ text: reports.dayEnd, style: style("bold", 13) }, { text: sheet.date, style: style("regular", 8.5) });
  page.space(8);
  page.rule();
  page.space(9);

  if (sheet.people.length === 0) {
    page.text(reports.dayEndEmpty, style("regular", 9, "muted"));
  } else {
    page.text(reports.byPerson, style("semibold", 9.5));
    page.space(4);
    for (const person of sheet.people) {
      page.text(person.name, style("semibold", 9));
      for (const each of person.lines) line(each.label, each.value, style("regular", 8.5), INDENT);
      line(reports.handOver, person.handOver, style("bold", 8.5), INDENT);
      page.space(6);
      page.mayBreak();
    }

    page.space(4);
    page.text(reports.byMethod, style("semibold", 9.5));
    page.space(4);
    const head = style("semibold", 7.5, "muted");
    const { methodColumns: columns } = reports;
    page.mark(columns.method, head);
    endAt(columns.received, head, RECEIVED_END);
    endAt(columns.refunded, head, REFUNDED_END);
    endAt(columns.net, head, PDF_INNER);
    page.space(leading(head.size) + 2);
    page.rule();
    page.space(5);
    const body = style("regular", 8.5);
    for (const method of sheet.methods) {
      page.mark(method.label, body);
      endAt(method.received, body, RECEIVED_END);
      endAt(method.refunded, body, REFUNDED_END);
      endAt(method.net, body, PDF_INNER);
      page.space(leading(body.size) + 2);
    }
    page.rule();
    page.space(6);
    line(reports.netCollected, sheet.net, style("bold", 10));
    if (sheet.voided) page.text(sheet.voided, style("regular", 8, "muted"));
    page.mayBreak();
  }

  // The sign-off (D360): who counted the money over, and who received it.
  const foot = composer(measure, PDF_INNER);
  foot.space(30);
  foot.rule({ wide: SIGN, color: "ink" });
  foot.rule({ x: PDF_INNER - SIGN, wide: SIGN, color: "ink" });
  foot.space(4);
  foot.mark(words.countedBy, style("regular", 7.5, "muted"));
  foot.mark(words.receivedBy, style("regular", 7.5, "muted"), { x: PDF_INNER - SIGN });
  foot.space(leading(7.5) + 8);

  const { height, ops, breaks } = page.done();
  const signOff = foot.done();
  return {
    height,
    ops,
    breaks,
    foot: { height: signOff.height, ops: signOff.ops },
    running: words.collectionsRunning(sheet.date),
  };
}
