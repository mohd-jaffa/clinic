import { DISCOUNT_PERCENT } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import {
  BILL_FROM,
  BILLING_ROUTE,
  patientRoute,
  QUEUE_ROUTE,
  visitRoute,
  type BillFrom,
  type NewBillFor,
} from "@/constants/navigation";
import { DEFAULT_CONSULTATION_SERVICE } from "@/constants/seeds";
import type { DiscountKind, PaymentMethod, ServiceCategory } from "@/constants/statuses";
import type { Service } from "@/features/clinic/types";
import { formatPaise } from "@/lib/format/currency";
import { paiseToText, parseRupees } from "@/lib/money";
import type { BillInput, CollectFeeInput } from "@/lib/validation";

import { billTotals, type BillDiscount, type BillTotals } from "./totals";
import type { BillDetail, BillStart } from "./types";

const { billing: words } = UI_TEXT;

/**
 * A line as the new bill holds it (plan §15.2): a price-list entry — with
 * its name and category to show, and the treatment it is for (D285) — a
 * typed line (D284), or a treatment waiting for its entry to be picked
 * (D308). Prices are the text in the field, read into paise when sent.
 */
export type BillFormLine =
  | {
      kind: "SERVICE";
      serviceId: string;
      name: string;
      category: ServiceCategory;
      treatmentId: string | null;
      treatmentName: string | null;
      quantity: number;
      price: string;
    }
  | { kind: "TYPED"; description: string; quantity: number; price: string }
  | { kind: "PICK"; treatmentId: string; name: string };

/** A new bill as its form holds it: what the schema reads, the lines with what they show. */
export interface BillForm extends Omit<BillInput, "lines" | "discount" | "collect"> {
  lines: BillFormLine[];
  discount: { kind: "NONE" | DiscountKind; amount: string; percent: string };
  /** `typed` once an amount is typed: until then it is the total (D304). */
  collect: { on: boolean; amount: string; method: PaymentMethod; reference: string; typed: boolean };
}

/** The method Collect now starts on (D304). */
export const FIRST_METHOD: PaymentMethod = "CASH";

/** The clinic's consultation (D26): its Consultation entry, or else its first in that category — none when archived. */
export function consultationOf(services: readonly Service[]): Service | null {
  const consultations = services.filter((service) => service.active && service.category === "CONSULTATION");
  return (
    consultations.find((service) => service.name === DEFAULT_CONSULTATION_SERVICE.name) ?? consultations[0] ?? null
  );
}

/** An entry's price on this bill: the doctor's own fee for the consultation (D26, D289), else the price list's. */
export function priceOf(service: Service, services: readonly Service[], feePaise: number | null): number {
  return feePaise !== null && service.id === consultationOf(services)?.id ? feePaise : service.pricePaise;
}

/** A price-list entry as a line of one, at its price on this bill — for a treatment, if it is one's (D285). */
export function serviceLine(
  service: Service,
  pricePaise: number,
  treatment: { id: string; name: string } | null = null,
): BillFormLine {
  return {
    kind: "SERVICE",
    serviceId: service.id,
    name: service.name,
    category: service.category,
    treatmentId: treatment?.id ?? null,
    treatmentName: treatment?.name ?? null,
    quantity: 1,
    price: paiseToText(pricePaise),
  };
}

/** The same name, however it is cased or spaced. */
const sameName = (a: string, b: string) => {
  const plain = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN");
  return plain(a) === plain(b);
};

/**
 * What a new bill starts with (plan §15.2; D26, D285, D308): for a visit or
 * an arrival, the consultation at the doctor's fee — unless one is billed
 * for it already (D286) — then each treatment worked on in the visit as the
 * price-list entry of its name, or a reminder to pick one. From a patient,
 * nothing yet.
 */
export function startingLines(start: BillStart, services: readonly Service[]): BillFormLine[] {
  const lines: BillFormLine[] = [];
  const consultation = consultationOf(services);
  const feePaise = start.doctor?.feePaise ?? null;
  if ((start.visit || start.appointment) && !start.consultationBilled && consultation) {
    lines.push(serviceLine(consultation, priceOf(consultation, services, feePaise)));
  }
  for (const treatment of start.treatments) {
    const entry = services.find((service) => service.active && sameName(service.name, treatment.name));
    lines.push(
      entry
        ? serviceLine(entry, priceOf(entry, services, feePaise), treatment)
        : { kind: "PICK", treatmentId: treatment.id, name: treatment.name },
    );
  }
  return lines;
}

/** A new bill's form (D304): its starting lines, no discount, no notes, and Collect now on, in Cash. */
export function blankBill(start: BillStart, services: readonly Service[]): BillForm {
  return {
    patientId: start.patient.id,
    visitId: start.visit?.id ?? null,
    appointmentId: start.visit ? null : (start.appointment?.id ?? null),
    lines: startingLines(start, services),
    discount: { kind: "NONE", amount: "", percent: "" },
    notes: "",
    collect: { on: true, amount: "", method: FIRST_METHOD, reference: "", typed: false },
  };
}

/**
 * A void bill issued again (D314): its lines as they were — a price-list
 * line, its treatment named when the visit still has it to bill; a line
 * whose entry is gone, typed — its discount as an amount, and its notes, on
 * the new bill's start.
 */
export function reissuedBill(start: BillStart, services: readonly Service[], bill: BillDetail): BillForm {
  const lines = bill.lines.map((line): BillFormLine => {
    const service = services.find((each) => each.id === line.serviceId);
    const price = paiseToText(line.unitPricePaise);
    if (!service) return { kind: "TYPED", description: line.description, quantity: line.quantity, price };
    const treatment = start.treatments.find((each) => each.id === line.treatmentId);
    return {
      kind: "SERVICE",
      serviceId: service.id,
      name: line.description,
      category: service.category,
      treatmentId: line.treatmentId,
      treatmentName: treatment?.name ?? null,
      quantity: line.quantity,
      price,
    };
  });
  return {
    ...blankBill(start, services),
    lines,
    discount:
      bill.discountPaise > 0
        ? { kind: "AMOUNT", amount: paiseToText(bill.discountPaise), percent: "" }
        : { kind: "NONE", amount: "", percent: "" },
    notes: bill.notes ?? "",
  };
}

/** A line's price as typed, in paise — nothing for what is not an amount yet. */
export const linePaise = (line: BillFormLine) => (line.kind === "PICK" ? 0 : (parseRupees(line.price) ?? 0));

/** A line's quantity as typed — nothing for an emptied field. */
const lineQuantity = (line: BillFormLine) =>
  line.kind === "PICK" || !Number.isInteger(line.quantity) ? 0 : line.quantity;

/** The discount as typed, when it reads as one. */
function discountOf({ kind, amount, percent }: BillForm["discount"]): BillDiscount | null {
  if (kind === "AMOUNT") {
    const paise = parseRupees(amount);
    return paise === null ? null : { kind, paise };
  }
  if (kind === "PERCENT") {
    const whole = /^\d{1,3}$/.test(percent.trim()) ? Number(percent) : Number.NaN;
    return whole >= DISCOUNT_PERCENT.min && whole <= DISCOUNT_PERCENT.max ? { kind, percent: whole } : null;
  }
  return null;
}

/**
 * The live preview (plan §15.2): the totals by the one formula
 * (billing/totals.ts) from what is typed so far — a discount beyond the bill
 * shown as the whole of it until its field is fixed (D293).
 */
export function previewOf(form: Pick<BillForm, "lines" | "discount">): BillTotals {
  const lines = form.lines.map((line) => ({ quantity: lineQuantity(line), unitPricePaise: linePaise(line) }));
  const subtotal = billTotals(lines, null).subtotal;
  const discount = discountOf(form.discount);
  const capped = discount?.kind === "AMOUNT" ? { ...discount, paise: Math.min(discount.paise, subtotal) } : discount;
  return billTotals(lines, capped);
}

/** What is collected, as typed (D304) — nothing while Collect now is off, or the amount is not one yet. */
export const collectedOf = ({ on, amount }: BillForm["collect"]) => (on ? (parseRupees(amount) ?? 0) : 0);

/** A balance in words (plan §15.4): due, advance, or nothing due. */
export function balanceWords(paise: number): string {
  if (paise > 0) return words.due(formatPaise(paise));
  if (paise < 0) return words.advance(formatPaise(-paise));
  return words.settled;
}

/**
 * The form as it is sent: a reminder line stays, so the schema can say what
 * it needs (D308); the amount collected is the total until one is typed, and
 * nothing is collected on a bill that comes to nothing (D304).
 */
export function toBillInput(form: BillForm): BillInput {
  const { total } = previewOf(form);
  const { typed, ...collect } = form.collect;
  return {
    ...form,
    lines: form.lines.map((line) =>
      line.kind === "SERVICE"
        ? {
            kind: line.kind,
            serviceId: line.serviceId,
            treatmentId: line.treatmentId,
            quantity: line.quantity,
            price: line.price,
          }
        : line,
    ),
    collect:
      collect.on && total > 0
        ? { ...collect, on: true, amount: typed ? collect.amount : paiseToText(total) }
        : { on: false },
  };
}

const BILL_FROMS: readonly BillFrom[] = [BILL_FROM.billing, BILL_FROM.patient];

/** Where the address says a new bill was started from, when it says so. */
export const billFromOf = (value: string | null) => BILL_FROMS.find((from) => from === value);

/**
 * Where a new bill leads back to, and goes once issued (D302): Billing, when
 * started there; the patient's profile, for the visit to bill it offered
 * (D313) — once the patient is known; else what it bills — the visit, the
 * patient's profile, or the queue for an arrival.
 */
export function billBackOf(target: NewBillFor | null, from: BillFrom | undefined, patientId?: string): string {
  if (from === BILL_FROM.patient && patientId) return patientRoute(patientId);
  if (from === BILL_FROM.billing || target === null) return BILLING_ROUTE;
  if ("visit" in target) return visitRoute(target.visit);
  if ("patient" in target) return patientRoute(target.patient);
  return QUEUE_ROUTE;
}

/**
 * Collect fee as it is sent (D283, D305): a bill for the arrival of its one
 * line — the consultation at the fee — and the fee collected with it;
 * nothing collected on a fee of nothing.
 */
export function feeBillInput(
  start: BillStart,
  consultation: Service,
  { fee, method, reference }: CollectFeeInput,
): BillInput {
  const owing = (parseRupees(fee) ?? 0) > 0;
  return {
    patientId: start.patient.id,
    visitId: null,
    appointmentId: start.appointment?.id ?? null,
    lines: [{ kind: "SERVICE", serviceId: consultation.id, treatmentId: null, quantity: 1, price: fee }],
    discount: { kind: "NONE" },
    notes: "",
    collect: owing ? { on: true, amount: fee, method, reference } : { on: false },
  };
}
