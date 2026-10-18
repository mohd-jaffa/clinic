import { describe, expect, it } from "vitest";

import { BILL_MAX_ITEMS, MAX_AMOUNT_PAISE, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { formatPaise } from "@/lib/format/currency";
import { billSchema, billStartQuerySchema, collectFeeSchema, firstIssue, type BillInput } from "@/lib/validation";

const PATIENT = "11111111-1111-4111-8111-111111111111";
const VISIT = "22222222-2222-4222-8222-222222222222";
const SERVICE = "33333333-3333-4333-8333-333333333333";
const TREATMENT = "44444444-4444-4444-8444-444444444444";
const { billing: words } = UI_TEXT;

const consultation = { kind: "SERVICE" as const, serviceId: SERVICE, treatmentId: null, quantity: 1, price: "500" };
const typed: BillInput = {
  patientId: PATIENT,
  visitId: VISIT,
  appointmentId: null,
  lines: [consultation],
  discount: { kind: "NONE" },
  notes: "",
  collect: { on: false },
};
const messageOf = (result: { success: boolean; error?: Parameters<typeof firstIssue>[0] }) =>
  result.success ? null : firstIssue(result.error!);
const pathsOf = (input: unknown) => {
  const result = billSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};

describe("billStartQuerySchema (plan §15.2, D313)", () => {
  it("takes exactly one of a visit, an arrival or a patient, by id", () => {
    expect(billStartQuerySchema.parse({ visit: VISIT })).toEqual({ visit: VISIT });
    expect(billStartQuerySchema.parse({ patient: PATIENT })).toEqual({ patient: PATIENT });
    expect(messageOf(billStartQuerySchema.safeParse({}))).toBe(VALIDATION_MESSAGES.invalid);
    expect(messageOf(billStartQuerySchema.safeParse({ visit: VISIT, patient: PATIENT }))).toBe(
      VALIDATION_MESSAGES.invalid,
    );
    expect(messageOf(billStartQuerySchema.safeParse({ appointment: "seven" }))).toBe(VALIDATION_MESSAGES.invalid);
  });
});

describe("billSchema (plan §15.2; D284, D285, D290 – D293, D304, D308)", () => {
  it("reads a price-list line into paise, with nothing collected and no discount", () => {
    expect(billSchema.parse(typed)).toEqual({
      patientId: PATIENT,
      visitId: VISIT,
      appointmentId: null,
      items: [{ serviceId: SERVICE, treatmentId: null, description: null, quantity: 1, unitPricePaise: 50_000 }],
      discount: null,
      notes: null,
      payment: null,
    });
  });

  it("keeps the treatment a price-list line is for, and a typed line's own words and price", () => {
    const parsed = billSchema.parse({
      ...typed,
      lines: [
        { ...consultation, treatmentId: TREATMENT, quantity: 2, price: "1,200.50" },
        { kind: "TYPED", description: "  Dressing   kit ", quantity: 3, price: "₹40" },
      ],
      notes: "  Paid by her son ",
    });
    expect(parsed.items).toEqual([
      { serviceId: SERVICE, treatmentId: TREATMENT, description: null, quantity: 2, unitPricePaise: 120_050 },
      { serviceId: null, treatmentId: null, description: "Dressing kit", quantity: 3, unitPricePaise: 4_000 },
    ]);
    expect(parsed.notes).toBe("Paid by her son");
  });

  it("reads a discount as an amount or a whole percentage, and what is collected", () => {
    expect(billSchema.parse({ ...typed, discount: { kind: "AMOUNT", amount: "50", percent: "" } }).discount).toEqual({
      kind: "AMOUNT",
      paise: 5_000,
    });
    expect(billSchema.parse({ ...typed, discount: { kind: "PERCENT", amount: "", percent: "15" } }).discount).toEqual({
      kind: "PERCENT",
      percent: 15,
    });
    expect(
      billSchema.parse({ ...typed, collect: { on: true, amount: "500", method: "UPI", reference: " UTR 42 " } })
        .payment,
    ).toEqual({ amountPaise: 50_000, method: "UPI", reference: "UTR 42" });
  });

  it("refuses a discount larger than the bill at its field, never capping it (D293)", () => {
    const result = billSchema.safeParse({ ...typed, discount: { kind: "AMOUNT", amount: "600" } });
    expect(messageOf(result)).toBe(VALIDATION_MESSAGES.discountTooLarge);
    expect(pathsOf({ ...typed, discount: { kind: "AMOUNT", amount: "600" } })).toEqual(["discount.amount"]);
    expect(billSchema.safeParse({ ...typed, discount: { kind: "AMOUNT", amount: "500" } }).success).toBe(true);
  });

  it("holds a percentage to 1 – 100 and a discount amount to an amount", () => {
    expect(messageOf(billSchema.safeParse({ ...typed, discount: { kind: "PERCENT", percent: "0" } }))).toBe(
      VALIDATION_MESSAGES.between(words.discountPercentLabel, 1, 100),
    );
    expect(messageOf(billSchema.safeParse({ ...typed, discount: { kind: "PERCENT", percent: "12.5" } }))).toBe(
      VALIDATION_MESSAGES.wholeNumber(words.discountPercentLabel),
    );
    expect(messageOf(billSchema.safeParse({ ...typed, discount: { kind: "AMOUNT", amount: "lots" } }))).toBe(
      VALIDATION_MESSAGES.amount(words.discountAmountLabel),
    );
    expect(messageOf(billSchema.safeParse({ ...typed, discount: { kind: "SOME" } }))).toBe(VALIDATION_MESSAGES.invalid);
  });

  it("never issues a treatment's reminder line: an entry is picked for it, or it goes (D308)", () => {
    const withReminder = {
      ...typed,
      lines: [consultation, { kind: "PICK", treatmentId: TREATMENT, name: "Root canal" }],
    };
    expect(messageOf(billSchema.safeParse(withReminder))).toBe(VALIDATION_MESSAGES.pickEntry("Root canal"));
    expect(pathsOf(withReminder)).toEqual(["lines.1.name"]);
  });

  it("asks for a line, holds a bill to its most lines, and each line and the bill to what they may come to", () => {
    expect(messageOf(billSchema.safeParse({ ...typed, lines: [] }))).toBe(VALIDATION_MESSAGES.billEmpty);
    expect(messageOf(billSchema.safeParse({ ...typed, lines: Array(BILL_MAX_ITEMS + 1).fill(consultation) }))).toBe(
      VALIDATION_MESSAGES.atMostBillLines(BILL_MAX_ITEMS),
    );
    const most = formatPaise(MAX_AMOUNT_PAISE);
    expect(
      messageOf(billSchema.safeParse({ ...typed, lines: [{ ...consultation, quantity: 999, price: "2000" }] })),
    ).toBe(VALIDATION_MESSAGES.tooLarge(words.lineLabel, most));
    expect(pathsOf({ ...typed, lines: [{ ...consultation, quantity: 999, price: "2000" }] })).toEqual([
      "lines.0.price",
    ]);
    const half = { ...consultation, quantity: 1, price: "600000" };
    expect(messageOf(billSchema.safeParse({ ...typed, lines: [half, half] }))).toBe(
      VALIDATION_MESSAGES.tooLarge(words.billLabel, most),
    );
  });

  it("says what is wrong with a line in words", () => {
    expect(messageOf(billSchema.safeParse({ ...typed, lines: [{ ...consultation, quantity: Number.NaN }] }))).toBe(
      VALIDATION_MESSAGES.required(words.quantityLabel),
    );
    expect(messageOf(billSchema.safeParse({ ...typed, lines: [{ ...consultation, price: "" }] }))).toBe(
      VALIDATION_MESSAGES.required(words.priceLabel),
    );
    expect(
      messageOf(
        billSchema.safeParse({ ...typed, lines: [{ kind: "TYPED", description: " ", quantity: 1, price: "1" }] }),
      ),
    ).toBe(VALIDATION_MESSAGES.required(words.descriptionLabel));
    expect(
      messageOf(
        billSchema.safeParse({
          ...typed,
          lines: [{ kind: "TYPED", description: "x".repeat(TEXT_LIMITS.serviceName + 1), quantity: 1, price: "1" }],
        }),
      ),
    ).toBe(VALIDATION_MESSAGES.tooLong(words.descriptionLabel, TEXT_LIMITS.serviceName));
    expect(messageOf(billSchema.safeParse({ ...typed, lines: [{ kind: "MYSTERY" }] }))).toBe(
      VALIDATION_MESSAGES.invalid,
    );
    expect(messageOf(billSchema.safeParse({ ...typed, lines: "all of it" }))).toBe(VALIDATION_MESSAGES.invalid);
  });

  it("collects more than nothing, by a method the clinic knows, with a reference that fits its column", () => {
    const collecting = (collect: object) => messageOf(billSchema.safeParse({ ...typed, collect }));
    expect(collecting({ on: true, amount: "0", method: "CASH", reference: "" })).toBe(
      VALIDATION_MESSAGES.moreThanZero(words.amountLabel),
    );
    expect(collecting({ on: true, amount: "10", method: "CHEQUE", reference: "" })).toBe(
      VALIDATION_MESSAGES.choose(words.methodLabel),
    );
    expect(
      collecting({ on: true, amount: "10", method: "CASH", reference: "x".repeat(TEXT_LIMITS.reference + 1) }),
    ).toBe(VALIDATION_MESSAGES.tooLong(words.referenceLabel, TEXT_LIMITS.reference));
    expect(collecting({ on: "maybe" })).toBe(VALIDATION_MESSAGES.invalid);
  });
});

describe("collectFeeSchema (plan §11.3; D283, D305)", () => {
  it("reads the fee into paise, the method and a reference", () => {
    expect(collectFeeSchema.parse({ fee: "800", method: "CASH", reference: "" })).toEqual({
      fee: 80_000,
      method: "CASH",
      reference: null,
    });
    expect(messageOf(collectFeeSchema.safeParse({ fee: "", method: "CASH", reference: "" }))).toBe(
      VALIDATION_MESSAGES.required(words.feeLabel),
    );
    expect(messageOf(collectFeeSchema.safeParse({ fee: "800", method: "", reference: "" }))).toBe(
      VALIDATION_MESSAGES.choose(words.methodLabel),
    );
  });
});
