import { UI_TEXT } from "@/constants/messages";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/constants/statuses";
import { formatPaise } from "@/lib/format/currency";

import type { DailyReport } from "./types";

/** What one person took, and handed back, on a day (D49, D357). */
export interface PersonCollections {
  /** Their account, or none for someone no longer on the team. */
  receivedBy: string | null;
  name: string | null;
  /** Each way they took or handed back money, in the app's order. */
  methods: { method: PaymentMethod; receivedPaise: number; refundedPaise: number }[];
  /** The cash they took less the cash they handed back (D357): what they hand over. */
  cashPaise: number;
}

/** One way money came in on a day, and went back out. */
export interface MethodCollections {
  method: PaymentMethod;
  receivedPaise: number;
  refundedPaise: number;
  netPaise: number;
}

/** The day-end collection summary (plan §18; D49, D357, D358). */
export interface DayEnd {
  people: PersonCollections[];
  methods: MethodCollections[];
  voided: DailyReport["voided"];
  /** Everything taken less everything handed back: the day's Collected. */
  netPaise: number;
}

const order = (method: PaymentMethod) => PAYMENT_METHODS.indexOf(method);

/**
 * A day's collections gathered for the day-end summary (D49, D357, D358):
 * each person who took or handed back money — in the report's order, by
 * name — with each method they used and the cash they hand over; then each
 * method's totals, in the app's order of methods; the voids; and the net.
 */
export function dayEndOf(report: DailyReport): DayEnd {
  const people: PersonCollections[] = [];
  for (const taken of report.collections) {
    let person = people.find((each) => each.receivedBy === taken.receivedBy);
    if (!person) {
      person = { receivedBy: taken.receivedBy, name: taken.receiverName, methods: [], cashPaise: 0 };
      people.push(person);
    }
    // One row a person and a method (report_daily groups them so).
    person.methods.push({
      method: taken.method,
      receivedPaise: taken.receivedPaise,
      refundedPaise: taken.refundedPaise,
    });
    if (taken.method === "CASH") person.cashPaise += taken.receivedPaise - taken.refundedPaise;
  }
  for (const person of people) person.methods.sort((a, b) => order(a.method) - order(b.method));

  const methods = PAYMENT_METHODS.flatMap((method) => {
    const used = report.collections.filter((taken) => taken.method === method);
    if (used.length === 0) return [];
    const receivedPaise = used.reduce((sum, taken) => sum + taken.receivedPaise, 0);
    const refundedPaise = used.reduce((sum, taken) => sum + taken.refundedPaise, 0);
    return [{ method, receivedPaise, refundedPaise, netPaise: receivedPaise - refundedPaise }];
  });

  return {
    people,
    methods,
    voided: report.voided,
    netPaise: methods.reduce((sum, method) => sum + method.netPaise, 0),
  };
}

/** An amount that may be less than nothing, its minus the printer's own: "−₹200". */
export const signedPaise = (paise: number) => (paise < 0 ? `−${formatPaise(-paise)}` : formatPaise(paise));

/**
 * A person's day as lines, on the screen and on paper alike (D358): what
 * they took by each method — "UPI ₹1,000" — then what they handed back by
 * each — "Refunded, Cash −₹200".
 */
export function personLines(person: PersonCollections): { label: string; value: string }[] {
  const took = person.methods.filter((each) => each.receivedPaise > 0);
  const gave = person.methods.filter((each) => each.refundedPaise > 0);
  return [
    ...took.map(({ method, receivedPaise }) => ({
      label: PAYMENT_METHOD_LABELS[method],
      value: formatPaise(receivedPaise),
    })),
    ...gave.map(({ method, refundedPaise }) => ({
      label: UI_TEXT.reports.refunded(PAYMENT_METHOD_LABELS[method]),
      value: signedPaise(-refundedPaise),
    })),
  ];
}

/** The day's voids in a line — "Voided: 1 payment, ₹500" — or none. */
export function voidedLine({ payments, paymentPaise, refunds, refundPaise }: DailyReport["voided"]): string | null {
  const { reports: words } = UI_TEXT;
  const parts = [
    ...(payments > 0 ? [words.voidedPayments(payments, formatPaise(paymentPaise))] : []),
    ...(refunds > 0 ? [words.voidedRefunds(refunds, formatPaise(refundPaise))] : []),
  ];
  return parts.length > 0 ? words.voided(parts.join(" · ")) : null;
}
