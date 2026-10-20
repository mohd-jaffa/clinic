import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PayingPatient } from "@/features/billing/components/RecordPaymentSheet";
import type { PatientListItem } from "@/features/patients/types";
import { Providers } from "@tests/support/providers";

const { client, search } = vi.hoisted(() => ({
  client: { record: vi.fn() },
  search: { current: undefined as unknown },
}));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: client }));
vi.mock("@/features/patients/hooks/usePatientSearch", () => ({
  usePatientSearch: () => ({ data: search.current }),
}));

const { RecordPaymentSheet } = await import("@/features/billing/components/RecordPaymentSheet");

const PATIENT = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const OTHER = "8c2f5b63-4d6e-4f70-9bac-1d2e3f4a5b6c";
const found = (id: string, name: string, balancePaise: number): PatientListItem => ({
  id,
  number: 1042,
  name,
  phone: "+919876543210",
  dateOfBirth: "1990-01-01",
  gender: "FEMALE",
  lastVisitOn: null,
  balancePaise,
});
const ASHA: PayingPatient = { ...found(PATIENT, "Asha Rao", 120_000) };
const onClose = vi.fn();
const draw = (props: Partial<Parameters<typeof RecordPaymentSheet>[0]> = {}) =>
  render(<RecordPaymentSheet open onClose={onClose} {...props} />, { wrapper: Providers });
const sheet = (name = "Record payment") => screen.getByRole("dialog", { name });
const amount = () => within(sheet()).getByRole("textbox", { name: /^Amount/ });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date("2026-10-19T06:00:00Z"), toFake: ["Date"] });
  client.record.mockResolvedValue({ paymentId: "pay-1", balancePaise: 0 });
  search.current = { items: [ASHA, found(OTHER, "Ravi Rao", 0)], nextCursor: null };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RecordPaymentSheet (plan §15.3; D323, D324, D334)", () => {
  it("searches first; the one picked shows their balance and fills the amount with what they owe", async () => {
    draw();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Record payment" }));
    expect(await within(sheet()).findByText("Choose patient.")).toBeInTheDocument();
    await userEvent.type(within(sheet()).getByRole("searchbox"), "rao");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Asha Rao" }));
    expect(within(sheet()).getByText("Balance: ₹1,200 due")).toBeInTheDocument();
    expect(amount()).toHaveValue("1200");

    // Another, who owes nothing, empties it — until an amount of one's own is typed.
    await userEvent.click(within(sheet()).getByRole("button", { name: "Change Asha Rao" }));
    await userEvent.type(within(sheet()).getByRole("searchbox"), "rao");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Ravi Rao" }));
    expect(within(sheet()).getByText("Balance: Nothing due")).toBeInTheDocument();
    expect(amount()).toHaveValue("");
    await userEvent.type(amount(), "300");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Change Ravi Rao" }));
    await userEvent.type(within(sheet()).getByRole("searchbox"), "rao");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Asha Rao" }));
    expect(amount()).toHaveValue("300");

    await userEvent.click(within(sheet()).getByRole("radio", { name: "UPI" }));
    await userEvent.type(within(sheet()).getByRole("textbox", { name: /^Reference/ }), "UTR 42");
    await userEvent.type(within(sheet()).getByRole("textbox", { name: /^Note/ }), "Part");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Record payment" }));
    await waitFor(() =>
      expect(client.record).toHaveBeenCalledWith({
        input: {
          patientId: PATIENT,
          kind: "PAYMENT",
          amount: "300",
          paidOn: "2026-10-19",
          method: "UPI",
          reference: "UTR 42",
          note: "Part",
        },
        key: expect.any(String),
      }),
    );
    expect(onClose).toHaveBeenCalled();
    expect((await screen.findAllByText("₹300 received from Asha Rao"))[0]).toBeInTheDocument();
  });

  it("names the patient it was opened for, filled with what they owe — or the amount it was opened with", () => {
    const first = draw({ patient: ASHA });
    expect(within(sheet()).queryByRole("searchbox")).not.toBeInTheDocument();
    expect(within(sheet()).getByText("Asha Rao")).toBeInTheDocument();
    expect(within(sheet()).getByText("36 y · Female · P-1042")).toBeInTheDocument();
    expect(amount()).toHaveValue("1200");
    expect(within(sheet()).getByText("Paid on")).toBeInTheDocument();
    first.unmount();

    draw({ patient: ASHA, amountPaise: 40_000, billId: "b-1" });
    expect(amount()).toHaveValue("400");
  });

  it("refunds the advance held: the amount, the method and a reference, no day and no note (D322)", async () => {
    draw({ patient: { ...ASHA, balancePaise: -50_000 }, kind: "REFUND" });
    const refund = sheet("Refund");
    expect(within(refund).getByText("Balance: ₹500 advance")).toBeInTheDocument();
    expect(within(refund).getByRole("textbox", { name: /^Amount/ })).toHaveValue("500");
    expect(within(refund).getByText("Up to the ₹500 advance they hold.")).toBeInTheDocument();
    expect(within(refund).queryByText("Paid on")).not.toBeInTheDocument();
    expect(within(refund).queryByRole("textbox", { name: /^Note/ })).not.toBeInTheDocument();
    await userEvent.click(within(refund).getByRole("button", { name: "Refund" }));
    await waitFor(() =>
      expect(client.record).toHaveBeenCalledWith({
        input: expect.objectContaining({ kind: "REFUND", amount: "500" }),
        key: expect.any(String),
      }),
    );
    expect((await screen.findAllByText("₹500 refunded to Asha Rao"))[0]).toBeInTheDocument();
  });

  it("starts empty with no one to owe, and a refund with nothing held says so", () => {
    draw({ patient: { ...ASHA, balancePaise: 0 }, kind: "REFUND" });
    expect(within(sheet("Refund")).getByText("Up to the ₹0 advance they hold.")).toBeInTheDocument();
  });

  it("refuses an amount of nothing, in its field's words", async () => {
    draw({ patient: { ...ASHA, balancePaise: 0 } });
    expect(amount()).toHaveValue("");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Record payment" }));
    expect(await within(sheet()).findByText("Amount needs a value.")).toBeInTheDocument();
    expect(client.record).not.toHaveBeenCalled();
  });
});

describe("RecordPaymentSheet's picker before a choice", () => {
  it("names no balance until a patient is picked", () => {
    search.current = undefined;
    draw();
    expect(within(sheet()).queryByText(/^Balance/)).not.toBeInTheDocument();
  });
});
