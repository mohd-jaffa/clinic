import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TEXT_LIMITS } from "@/constants/limits";
import type { Payment } from "@/features/billing/types";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { voidPayment: vi.fn() } }));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: client }));

const { VoidPaymentSheet } = await import("@/features/billing/components/VoidPaymentSheet");

const payment = {
  id: "pay-1",
  kind: "PAYMENT",
  amountPaise: 50_000,
  patient: { id: "p-1", name: "Asha Rao" },
} as Payment;
const onDone = vi.fn();
const draw = (of: Payment = payment) =>
  render(<VoidPaymentSheet payment={of} open onClose={vi.fn()} onDone={onDone} />, { wrapper: Providers });

beforeEach(() => {
  vi.clearAllMocks();
  client.voidPayment.mockResolvedValue({ balancePaise: 50_000 });
});

describe("VoidPaymentSheet (plan §15.3; D336)", () => {
  it("names the payment, asks why, then asks to be sure before voiding it", async () => {
    draw();
    const sheet = screen.getByRole("dialog", { name: "Void payment" });
    expect(within(sheet).getByText("Payment · ₹500")).toBeInTheDocument();
    expect(within(sheet).getByText("Asha Rao")).toBeInTheDocument();
    const reason = within(sheet).getByRole("textbox", { name: /^Reason/ });
    expect(reason).toHaveAttribute("maxlength", String(TEXT_LIMITS.reason));
    await userEvent.click(within(sheet).getByRole("button", { name: "Void payment" }));
    expect(await within(sheet).findByText("Reason needs a value.")).toBeInTheDocument();
    await userEvent.type(reason, "Entered twice");
    await userEvent.click(within(sheet).getByRole("button", { name: "Void payment" }));
    const card = await screen.findByRole("alertdialog", { name: "Void the payment of ₹500?" });
    await userEvent.click(within(card).getByRole("button", { name: "Void payment" }));
    await waitFor(() =>
      expect(client.voidPayment).toHaveBeenCalledWith({ paymentId: "pay-1", input: { reason: "Entered twice" } }),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it("says a refund in its own words", () => {
    draw({ ...payment, kind: "REFUND" });
    expect(screen.getByRole("dialog", { name: "Void refund" })).toHaveTextContent("Refund · ₹500");
  });
});
