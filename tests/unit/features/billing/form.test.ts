import { describe, expect, it } from "vitest";

import { UI_TEXT } from "@/constants/messages";
import type { Service } from "@/features/clinic/types";
import {
  balanceWords,
  billBackOf,
  billFromOf,
  blankBill,
  collectedOf,
  consultationOf,
  feeBillInput,
  linePaise,
  previewOf,
  priceOf,
  reissuedBill,
  serviceLine,
  startingLines,
  toBillInput,
  type BillForm,
} from "@/features/billing/form";
import type { BillDetail, BillStart } from "@/features/billing/types";
import { formatPaise } from "@/lib/format/currency";

const { billing: words } = UI_TEXT;

const entry = (
  id: string,
  name: string,
  category: Service["category"],
  pricePaise: number,
  active = true,
): Service => ({
  id,
  name,
  category,
  pricePaise,
  active,
});
const consultation = entry("s-c", "Consultation", "CONSULTATION", 50_000);
const review = entry("s-r", "Review", "CONSULTATION", 30_000);
const rootCanal = entry("s-rc", "Root canal", "PROCEDURE", 600_000);
const services = [consultation, review, rootCanal, entry("s-x", "X-ray", "INVESTIGATION", 40_000, false)];

const start: BillStart = {
  patient: { id: "p-1", name: "Asha Rao", number: 1042, dateOfBirth: "1990-01-01", gender: "FEMALE", archived: false },
  visit: { id: "v-1", day: "2026-10-16", status: "COMPLETED", billingStatus: "TO_BILL" },
  appointment: null,
  doctor: { id: "d-1", name: "Maya Rao", feePaise: 80_000 },
  consultationBilled: false,
  treatments: [
    { id: "t-1", name: "root  canal " },
    { id: "t-2", name: "Crown" },
  ],
  balancePaise: 0,
  toBill: null,
};

describe("consultationOf, priceOf (D26, D289)", () => {
  it("takes the clinic's Consultation, else its first consultation in use — none when there is none", () => {
    expect(consultationOf(services)).toBe(consultation);
    expect(consultationOf([review, rootCanal])).toBe(review);
    expect(consultationOf([{ ...consultation, active: false }, rootCanal])).toBeNull();
  });

  it("prices the consultation at the doctor's own fee, and anything else at the price list's", () => {
    expect(priceOf(consultation, services, 80_000)).toBe(80_000);
    expect(priceOf(consultation, services, null)).toBe(50_000);
    expect(priceOf(review, services, 80_000)).toBe(30_000);
  });
});

describe("startingLines (plan §15.2; D285, D286, D308)", () => {
  it("starts a visit's bill with the consultation at the fee, then each treatment as the entry of its name", () => {
    expect(startingLines(start, services)).toEqual([
      serviceLine(consultation, 80_000),
      serviceLine(rootCanal, 600_000, { id: "t-1", name: "root  canal " }),
      { kind: "PICK", treatmentId: "t-2", name: "Crown" },
    ]);
  });

  it("leaves out a consultation billed already, or with none in the price list; a patient's starts empty", () => {
    expect(startingLines({ ...start, consultationBilled: true, treatments: [] }, services)).toEqual([]);
    expect(startingLines({ ...start, treatments: [] }, [rootCanal])).toEqual([]);
    expect(startingLines({ ...start, visit: null, treatments: [] }, services)).toEqual([]);
    const arrival = { ...start, visit: null, appointment: { id: "a-1", status: "ARRIVED", token: 7 }, treatments: [] };
    expect(startingLines(arrival as BillStart, services)).toEqual([serviceLine(consultation, 80_000)]);
  });

  it("makes a line of one at its price, as a field holds it", () => {
    expect(serviceLine(rootCanal, 600_050)).toEqual({
      kind: "SERVICE",
      serviceId: "s-rc",
      name: "Root canal",
      category: "PROCEDURE",
      treatmentId: null,
      treatmentName: null,
      quantity: 1,
      price: "6000.50",
    });
  });
});

describe("blankBill (D304)", () => {
  it("bills the visit, with Collect now on in Cash, following the total", () => {
    expect(blankBill(start, services)).toMatchObject({
      patientId: "p-1",
      visitId: "v-1",
      appointmentId: null,
      discount: { kind: "NONE", amount: "", percent: "" },
      notes: "",
      collect: { on: true, amount: "", method: "CASH", reference: "", typed: false },
    });
    const arrival = { ...start, visit: null, appointment: { id: "a-1" } } as BillStart;
    expect(blankBill(arrival, services)).toMatchObject({ visitId: null, appointmentId: "a-1" });
  });
});

const form = (overrides: Partial<BillForm> = {}): BillForm => ({
  ...blankBill({ ...start, treatments: [] }, services),
  ...overrides,
});

describe("previewOf (plan §15.2, D290, D293)", () => {
  it("adds the lines as typed — what is not an amount, or a reminder, counts nothing", () => {
    const lines = [
      { ...serviceLine(consultation, 50_000), quantity: 2 },
      { kind: "TYPED" as const, description: "Kit", quantity: 1, price: "₹1,000.50" },
      { kind: "TYPED" as const, description: "Odd", quantity: 1, price: "lots" },
      { ...serviceLine(review, 30_000), quantity: Number.NaN },
      { kind: "PICK" as const, treatmentId: "t-2", name: "Crown" },
    ];
    expect(previewOf(form({ lines }))).toEqual({ subtotal: 200_050, discount: 0, total: 200_050 });
    expect(linePaise(lines[4])).toBe(0);
  });

  it("takes a discount as an amount, a whole percentage, or none while it is not one yet", () => {
    const of = (discount: BillForm["discount"]) => previewOf(form({ discount }));
    expect(of({ kind: "AMOUNT", amount: "100", percent: "" })).toEqual({
      subtotal: 80_000,
      discount: 10_000,
      total: 70_000,
    });
    expect(of({ kind: "PERCENT", amount: "", percent: "15" })).toMatchObject({ discount: 12_000 });
    expect(of({ kind: "AMOUNT", amount: "lots", percent: "" })).toMatchObject({ discount: 0 });
    expect(of({ kind: "PERCENT", amount: "", percent: "0" })).toMatchObject({ discount: 0 });
    expect(of({ kind: "PERCENT", amount: "", percent: "12.5" })).toMatchObject({ discount: 0 });
  });

  it("shows a discount beyond the bill as the whole of it until its field is fixed (D293)", () => {
    expect(previewOf(form({ discount: { kind: "AMOUNT", amount: "5000", percent: "" } }))).toEqual({
      subtotal: 80_000,
      discount: 80_000,
      total: 0,
    });
  });
});

describe("collectedOf, balanceWords", () => {
  it("counts what is collected only while Collect now is on", () => {
    const collect = { on: true, amount: "500", method: "CASH" as const, reference: "", typed: true };
    expect(collectedOf(collect)).toBe(50_000);
    expect(collectedOf({ ...collect, amount: "lots" })).toBe(0);
    expect(collectedOf({ ...collect, on: false })).toBe(0);
  });

  it("says a balance as due, advance, or nothing due", () => {
    expect(balanceWords(30_000)).toBe(words.due(formatPaise(30_000)));
    expect(balanceWords(-20_000)).toBe(words.advance(formatPaise(20_000)));
    expect(balanceWords(0)).toBe(words.settled);
  });
});

describe("toBillInput (D304, D308)", () => {
  it("sends a price-list line without what it shows, and collects the total until an amount is typed", () => {
    expect(toBillInput(form())).toEqual({
      patientId: "p-1",
      visitId: "v-1",
      appointmentId: null,
      lines: [{ kind: "SERVICE", serviceId: "s-c", treatmentId: null, quantity: 1, price: "800" }],
      discount: { kind: "NONE", amount: "", percent: "" },
      notes: "",
      collect: { on: true, amount: "800", method: "CASH", reference: "" },
    });
    const typed = form({ collect: { on: true, amount: "300", method: "UPI", reference: "R1", typed: true } });
    expect(toBillInput(typed).collect).toEqual({ on: true, amount: "300", method: "UPI", reference: "R1" });
  });

  it("collects nothing while Collect now is off, or on a bill that comes to nothing; a reminder goes as it is", () => {
    const off = form({ collect: { on: false, amount: "", method: "CASH", reference: "", typed: false } });
    expect(toBillInput(off).collect).toEqual({ on: false });
    const free = form({ discount: { kind: "PERCENT", amount: "", percent: "100" } });
    expect(toBillInput(free).collect).toEqual({ on: false });
    const pick = { kind: "PICK" as const, treatmentId: "t-2", name: "Crown" };
    expect(toBillInput(form({ lines: [pick] })).lines).toEqual([pick]);
  });
});

describe("billFromOf, billBackOf (D302, D313)", () => {
  it("reads where the address says it was started from, when it is one it knows", () => {
    expect(billFromOf("billing")).toBe("billing");
    expect(billFromOf("patient")).toBe("patient");
    expect(billFromOf("elsewhere")).toBeUndefined();
    expect(billFromOf(null)).toBeUndefined();
  });

  it("leads back to Billing when started there or for no one, else to what it bills", () => {
    expect(billBackOf({ visit: "v-1" }, "billing")).toBe("/billing");
    expect(billBackOf(null, undefined)).toBe("/billing");
    expect(billBackOf({ visit: "v-1" }, undefined)).toBe("/visits/v-1");
    expect(billBackOf({ patient: "p-1" }, undefined)).toBe("/patients/p-1");
    expect(billBackOf({ appointment: "a-1" }, undefined)).toBe("/queue");
  });

  it("leads a visit to bill offered on a profile back to the profile, once the patient is known", () => {
    expect(billBackOf({ visit: "v-1" }, "patient", "p-1")).toBe("/patients/p-1");
    expect(billBackOf({ visit: "v-1" }, "patient")).toBe("/visits/v-1");
  });
});

describe("feeBillInput (D283, D305)", () => {
  const arrival = { ...start, visit: null, appointment: { id: "a-1", status: "ARRIVED", token: 7 } } as BillStart;
  it("bills the arrival its consultation at the fee, collected in full", () => {
    expect(feeBillInput(arrival, consultation, { fee: "800", method: "UPI", reference: "R9" })).toEqual({
      patientId: "p-1",
      visitId: null,
      appointmentId: "a-1",
      lines: [{ kind: "SERVICE", serviceId: "s-c", treatmentId: null, quantity: 1, price: "800" }],
      discount: { kind: "NONE" },
      notes: "",
      collect: { on: true, amount: "800", method: "UPI", reference: "R9" },
    });
  });

  it("collects nothing on a fee of nothing, or one that is not an amount yet", () => {
    expect(feeBillInput(arrival, consultation, { fee: "0", method: "CASH", reference: "" }).collect).toEqual({
      on: false,
    });
    expect(
      feeBillInput({ ...arrival, appointment: null }, consultation, { fee: "x", method: "CASH", reference: "" }),
    ).toMatchObject({ appointmentId: null, collect: { on: false } });
  });
});

describe("reissuedBill (D314)", () => {
  const voided = {
    lines: [
      {
        description: "Root canal",
        quantity: 1,
        unitPricePaise: 550_000,
        amountPaise: 550_000,
        serviceId: "s-rc",
        treatmentId: "t-1",
      },
      {
        description: "Crown",
        quantity: 1,
        unitPricePaise: 300_000,
        amountPaise: 300_000,
        serviceId: "s-rc",
        treatmentId: "t-9",
      },
      {
        description: "Old kit",
        quantity: 2,
        unitPricePaise: 4_050,
        amountPaise: 8_100,
        serviceId: "s-gone",
        treatmentId: null,
      },
    ],
    discountPaise: 10_000,
    notes: "Paid by her son",
  } as BillDetail;

  it("fills the new bill with the void one's lines, its treatment named while the visit has it to bill, its discount and notes", () => {
    expect(reissuedBill(start, services, voided)).toMatchObject({
      patientId: "p-1",
      visitId: "v-1",
      lines: [
        {
          kind: "SERVICE",
          serviceId: "s-rc",
          name: "Root canal",
          category: "PROCEDURE",
          treatmentId: "t-1",
          treatmentName: "root  canal ",
          quantity: 1,
          price: "5500",
        },
        { kind: "SERVICE", name: "Crown", treatmentId: "t-9", treatmentName: null },
        // Its entry gone from the price list: typed.
        { kind: "TYPED", description: "Old kit", quantity: 2, price: "40.50" },
      ],
      discount: { kind: "AMOUNT", amount: "100", percent: "" },
      notes: "Paid by her son",
      collect: { on: true, typed: false },
    });
  });

  it("gives no discount or notes when the void one had none", () => {
    expect(reissuedBill(start, services, { ...voided, discountPaise: 0, notes: null })).toMatchObject({
      discount: { kind: "NONE", amount: "", percent: "" },
      notes: "",
    });
  });
});
