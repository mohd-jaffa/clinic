import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Payment } from "@/features/billing/types";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, list } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  list: { current: {} as { data?: unknown }, asked: vi.fn() },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/billing/hooks/usePayments", () => ({
  usePayments: (range: unknown) => {
    list.asked(range);
    return list.current;
  },
}));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: { voidPayment: vi.fn() } }));

const { PaymentsList } = await import("@/features/billing/components/PaymentsList");

const payment: Payment = {
  id: "pay-1",
  kind: "PAYMENT",
  amountPaise: 50_000,
  method: "UPI",
  reference: null,
  paidAt: "2020-01-14T05:30:00Z",
  paidOn: "2020-01-14",
  note: null,
  status: "RECORDED",
  receivedBy: "Priya Shah",
  void: null,
  patient: { id: "p-1", name: "Asha Rao", number: 1042, archived: false },
};
const range = { kind: "TODAY" as const, from: "2026-10-19", to: "2026-10-19" };

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  list.current = {
    data: [
      payment,
      { ...payment, id: "pay-2", kind: "REFUND", receivedBy: null },
      { ...payment, id: "pay-3", status: "VOID", void: { reason: "x", at: "2020-01-14T06:00:00Z", by: null } },
    ],
  };
});

describe("PaymentsList (plan §15.4; D320, D336)", () => {
  it("lists the payments and refunds of the days picked, each opening its sheet", async () => {
    render(<PaymentsList range={range} onRange={vi.fn()} />, { wrapper: Providers });
    expect(list.asked).toHaveBeenLastCalledWith(range);
    const [paid, refunded, voided] = within(screen.getByRole("list", { name: "Payments" })).getAllByRole("listitem");
    expect(paid).toHaveTextContent("Paid ₹500 · UPI");
    expect(paid).toHaveTextContent("14 Jan 2020 · Priya Shah");
    expect(refunded).toHaveTextContent("Refunded ₹500 · UPI");
    expect(within(refunded).getByText("Refund")).toBeInTheDocument();
    expect(within(voided).getByText("Void")).toBeInTheDocument();
    await userEvent.click(within(paid).getByRole("button", { name: "Asha Rao" }));
    expect(screen.getByRole("dialog", { name: "Payment" })).toBeInTheDocument();
  });

  it("says when nothing was paid on those days", () => {
    list.current = { data: [] };
    render(<PaymentsList range={range} onRange={vi.fn()} />, { wrapper: Providers });
    expect(screen.getByRole("heading", { name: "No payments on these days" })).toBeInTheDocument();
  });
});
