import { UI_TEXT } from "@/constants/messages";
import { PAYMENT_METHOD_LABELS } from "@/constants/statuses";
import { addDaysKey, dayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { composer, leading, type Measure, type PdfLayout, type TextStyle } from "@/lib/pdf/layout";
import { PDF_INNER } from "@/lib/pdf/render";

import type { ReceiptSheet, ReceiptSource } from "./types";

const { receipt: words } = UI_TEXT.documents;

/**
 * The days a payment paid for (plan §7.4): from the day after the later of
 * the plan's last day before it and the day before it was recorded — as
 * `extend_clinic_subscription` ran on from — to its new last day. A date set
 * earlier than that says only the day it runs until.
 */
export function periodOf({ validFrom, validUntil, recordedAt }: ReceiptSource): string {
  const before = addDaysKey(dayKey(recordedAt), -1);
  const from = addDaysKey(validFrom > before ? validFrom : before, 1);
  return from > validUntil
    ? words.until(formatDate(validUntil))
    : words.period(formatDate(from), formatDate(validUntil));
}

/**
 * The receipt in the words it is printed in (plan §7.5; D392): the platform's
 * name and address — the app's own name while none is set — the receipt's
 * number and the day it was recorded; who paid, for what plan and days; the
 * amount, and how and when it was paid.
 */
export function receiptSheet(source: ReceiptSource): ReceiptSheet {
  return {
    business: {
      name: source.business.name ?? UI_TEXT.appName,
      address: (source.business.address ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    },
    number: source.receiptNumber,
    date: formatDate(dayKey(source.recordedAt)),
    from: [`${source.clinic.name}, ${source.clinic.city}`, source.owner],
    forWhat: [words.plans[source.kind], periodOf(source)],
    amount: formatPaise(source.amountPaise),
    paid: words.paid(PAYMENT_METHOD_LABELS[source.method], source.reference, formatDate(source.paidOn)),
  };
}

const style = (face: TextStyle["face"], size: number, color: TextStyle["color"] = "ink"): TextStyle => ({
  face,
  size,
  color,
});

/**
 * Where everything on the receipt goes (D392): the platform's name and
 * address across the top over a rule; "Receipt" with its number set to the
 * right and the day under it; Received from and For, each a label over its
 * lines; the amount in bold set to the right, how it was paid under it; a
 * rule, and the line saying it is not a tax invoice. One page, always.
 */
export function layoutReceipt(sheet: ReceiptSheet, measure: Measure): PdfLayout {
  const page = composer(measure, PDF_INNER);
  const label = style("semibold", 7.5, "muted");
  const body = style("regular", 9.5);
  const right = (text: string, textStyle: TextStyle) => {
    page.mark(text, textStyle, { right: true });
    page.space(leading(textStyle.size));
  };
  const section = (title: string, lines: string[]) => {
    page.text(title, label);
    for (const line of lines) page.text(line, body);
    page.space(10);
  };

  page.text(sheet.business.name, style("bold", 15));
  for (const line of sheet.business.address) page.text(line, style("regular", 8.5, "muted"));
  page.space(8);
  page.rule();
  page.space(12);

  page.row({ text: words.heading, style: style("bold", 13) }, { text: sheet.number, style: style("semibold", 9.5) });
  right(sheet.date, style("regular", 8.5, "muted"));
  page.space(10);

  section(words.receivedFrom, sheet.from);
  section(words.forWhat, sheet.forWhat);

  page.row({ text: words.amount, style: style("semibold", 10) }, { text: sheet.amount, style: style("bold", 13) });
  page.text(sheet.paid, style("regular", 8.5, "muted"));
  page.space(12);
  page.rule();
  page.space(8);
  page.text(words.foot, style("regular", 8, "muted"));

  const { height, ops, breaks } = page.done();
  return { height, ops, breaks, foot: null, running: null };
}
