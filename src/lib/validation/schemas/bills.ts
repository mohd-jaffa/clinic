import * as z from "zod";

import { BILL_MAX_ITEMS, DISCOUNT_PERCENT, MAX_AMOUNT_PAISE, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { PAYMENT_METHODS } from "@/constants/statuses";
import { formatPaise } from "@/lib/format/currency";
import { sumPaise } from "@/lib/money";

import { optionalLine, optionalLines, paiseText, quantity, requiredLine, wholeNumberText } from "../primitives";

const { billing: words } = UI_TEXT;

const id = z.uuid({ error: VALIDATION_MESSAGES.invalid });

/**
 * Where a new bill starts (plan §15.2, D313): a visit, an arrival or a
 * patient — exactly one, by its id; never anything typed about them.
 */
export const billStartQuerySchema = z
  .object({ visit: id.optional(), appointment: id.optional(), patient: id.optional() })
  .refine(({ visit, appointment, patient }) => [visit, appointment, patient].filter(Boolean).length === 1, {
    message: VALIDATION_MESSAGES.invalid,
  });

export type BillStartQuery = z.output<typeof billStartQuerySchema>;

/** A line no more than a bill can hold (0028's CHECK): its quantity times its price. */
const withinBill = <Line extends { quantity: number; price: number }>(line: Line) =>
  line.quantity * line.price <= MAX_AMOUNT_PAISE;
const lineTooLarge = {
  path: ["price"],
  message: VALIDATION_MESSAGES.tooLarge(words.lineLabel, formatPaise(MAX_AMOUNT_PAISE)),
};

/** A price-list line (D285, D289): the entry, the treatment it is for, if any, how many and at what price. */
const serviceLine = z
  .object({
    kind: z.literal("SERVICE"),
    serviceId: id,
    treatmentId: id.nullable(),
    quantity: quantity(words.quantityLabel),
    price: paiseText(words.priceLabel),
  })
  .refine(withinBill, lineTooLarge);

/** A line typed with its own price (D284): with permission to give discounts only — the database holds it. */
const typedLine = z
  .object({
    kind: z.literal("TYPED"),
    description: requiredLine(words.descriptionLabel, { max: TEXT_LIMITS.serviceName }),
    quantity: quantity(words.quantityLabel),
    price: paiseText(words.priceLabel),
  })
  .refine(withinBill, lineTooLarge);

/**
 * A treatment worked on with no price-list entry of its name (D308): a
 * reminder, never issued — an entry is picked for it, or it is removed.
 */
const pickLine = z
  .object({ kind: z.literal("PICK"), treatmentId: id, name: z.string() })
  .superRefine(({ name }, ctx) => {
    ctx.addIssue({ code: "custom", path: ["name"], message: VALIDATION_MESSAGES.pickEntry(name) });
  });

/** A line that may be issued: anything but a reminder. */
const issuable = <Line extends { kind: string }>(line: Line): line is Exclude<Line, { kind: "PICK" }> =>
  line.kind !== "PICK";

/** The discount (D29, D290 – D293): none, an amount, or a whole percentage from 1 to 100. */
const discount = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("NONE") }),
    z.object({ kind: z.literal("AMOUNT"), amount: paiseText(words.discountAmountLabel) }),
    z.object({ kind: z.literal("PERCENT"), percent: wholeNumberText(words.discountPercentLabel, DISCOUNT_PERCENT) }),
  ],
  { error: VALIDATION_MESSAGES.invalid },
);

/** Collect now (D282, D304): nothing, or a payment — more than nothing — its method and a reference. */
const collect = z.discriminatedUnion(
  "on",
  [
    z.object({ on: z.literal(false) }),
    z.object({
      on: z.literal(true),
      amount: paiseText(words.amountLabel).refine((paise) => paise > 0, {
        message: VALIDATION_MESSAGES.moreThanZero(words.amountLabel),
      }),
      method: z.enum(PAYMENT_METHODS, { error: VALIDATION_MESSAGES.choose(words.methodLabel) }),
      reference: optionalLine(words.referenceLabel, TEXT_LIMITS.reference),
    }),
  ],
  { error: VALIDATION_MESSAGES.invalid },
);

/**
 * A bill as it is put together and issued (plan §15.2): who it is for and
 * what it bills — a visit or an arrival, or neither — its lines, the
 * discount, notes, and what is collected with it. Prices are typed in rupees
 * and read into paise. A discount larger than the bill is refused at its
 * field, never capped (D293). The totals are not sent: the server works them
 * out with billing/totals.ts, and the database again.
 */
export const billSchema = z
  .object({
    patientId: id,
    visitId: id.nullable(),
    appointmentId: id.nullable(),
    lines: z
      .array(z.discriminatedUnion("kind", [serviceLine, typedLine, pickLine]), { error: VALIDATION_MESSAGES.invalid })
      .min(1, VALIDATION_MESSAGES.billEmpty)
      .max(BILL_MAX_ITEMS, VALIDATION_MESSAGES.atMostBillLines(BILL_MAX_ITEMS)),
    discount,
    notes: optionalLines(words.notesLabel, TEXT_LIMITS.notes),
    collect,
  })
  .superRefine(({ lines, discount: given }, ctx) => {
    // What the lines come to: each its quantity times its price (billing/totals.ts's lineAmount).
    const subtotal = sumPaise(lines.map((line) => (line.kind === "PICK" ? 0 : line.quantity * line.price)));
    // A line already too large says so itself.
    if (subtotal > MAX_AMOUNT_PAISE && lines.every((line) => line.kind === "PICK" || withinBill(line))) {
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: VALIDATION_MESSAGES.tooLarge(words.billLabel, formatPaise(MAX_AMOUNT_PAISE)),
      });
    }
    if (given.kind === "AMOUNT" && given.amount > subtotal) {
      ctx.addIssue({ code: "custom", path: ["discount", "amount"], message: VALIDATION_MESSAGES.discountTooLarge });
    }
  })
  .transform(({ patientId, visitId, appointmentId, lines, discount: given, notes, collect: taken }) => ({
    patientId,
    visitId,
    appointmentId,
    // A reminder line is refused above, so none reaches here.
    items: lines.filter(issuable).map((line) => ({
      serviceId: line.kind === "SERVICE" ? line.serviceId : null,
      treatmentId: line.kind === "SERVICE" ? line.treatmentId : null,
      description: line.kind === "TYPED" ? line.description : null,
      quantity: line.quantity,
      unitPricePaise: line.price,
    })),
    discount:
      given.kind === "NONE"
        ? null
        : given.kind === "AMOUNT"
          ? { kind: "AMOUNT" as const, paise: given.amount }
          : { kind: "PERCENT" as const, percent: given.percent },
    notes,
    payment: taken.on ? { amountPaise: taken.amount, method: taken.method, reference: taken.reference } : null,
  }));

export type BillInput = z.input<typeof billSchema>;
export type BillPayload = z.output<typeof billSchema>;

/**
 * Collect fee at arrival (plan §11.3; D283, D305): the consultation fee —
 * changed only with permission to give discounts, which the database holds —
 * the method and a reference. Sent as a bill of that one line.
 */
export const collectFeeSchema = z.object({
  fee: paiseText(words.feeLabel),
  method: z.enum(PAYMENT_METHODS, { error: VALIDATION_MESSAGES.choose(words.methodLabel) }),
  reference: optionalLine(words.referenceLabel, TEXT_LIMITS.reference),
});

export type CollectFeeInput = z.input<typeof collectFeeSchema>;
export type CollectFeePayload = z.output<typeof collectFeeSchema>;
