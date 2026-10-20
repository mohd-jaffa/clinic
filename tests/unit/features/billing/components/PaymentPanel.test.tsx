import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/constants/permissions";
import type { Payment } from "@/features/billing/types";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: { voidPayment: vi.fn() } }));

const { PaymentPanel } = await import("@/features/billing/components/PaymentPanel");

const payment: Payment = {
  id: "pay-1",
  kind: "PAYMENT",
  amountPaise: 50_000,
  method: "UPI",
  reference: "UTR 42",
  paidAt: "2026-10-19T05:30:00Z",
  paidOn: "2026-10-19",
  note: "Paid by her son",
  status: "RECORDED",
  receivedBy: "Priya Shah",
  void: null,
  patient: { id: "p-1", name: "Asha Rao", number: 1042, archived: false },
};
const EDITS: Permission[] = ["patients.view", "payments.view", "payments.edit"];
const onClose = vi.fn();
const draw = (shown: Payment | null = payment, linkProfile?: boolean) =>
  render(<PaymentPanel payment={shown} open onClose={onClose} linkProfile={linkProfile} />, { wrapper: Providers });

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub({ role: "STAFF", permissions: EDITS });
});

describe("PaymentPanel (plan §15.3; D336)", () => {
  it("shows how much, from whom, its day, method, reference, who took it and its note, and the profile", () => {
    draw();
    const sheet = screen.getByRole("dialog", { name: "Payment" });
    expect(within(sheet).getByText("₹500")).toBeInTheDocument();
    expect(within(sheet).getByText("Asha Rao")).toBeInTheDocument();
    expect(within(sheet).getByText("P-1042")).toBeInTheDocument();
    for (const [label, value] of [
      ["Paid on", "19 Oct 2026"],
      ["Method", "UPI"],
      ["Reference", "UTR 42"],
      ["Received by", "Priya Shah"],
      ["Note", "Paid by her son"],
    ]) {
      expect(within(sheet).getByText(label, { selector: "dt" }).nextElementSibling).toHaveTextContent(value);
    }
    expect(within(sheet).getByRole("link", { name: "Open Asha Rao’s profile" })).toHaveAttribute(
      "href",
      "/patients/p-1",
    );
  });

  it("voids it for payments.edit, the reason over it; closing that comes back", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Void payment" }));
    const reason = screen.getByRole("dialog", { name: "Void payment" });
    await userEvent.click(within(reason).getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog", { name: "Payment" })).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Payment" })).getByRole("button", { name: "Close" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("says a void one's when, by whom and why, and a refund's own words, with no Void and no profile on the profile", () => {
    draw(
      {
        ...payment,
        kind: "REFUND",
        reference: null,
        note: null,
        receivedBy: null,
        status: "VOID",
        void: { reason: "Entered twice", at: "2026-10-19T07:00:00Z", by: "Asha Menon" },
      },
      false,
    );
    const sheet = screen.getByRole("dialog", { name: "Refund" });
    expect(within(sheet).getByText("Void")).toBeInTheDocument();
    expect(within(sheet).getByText("Voided 19 Oct 2026 by Asha Menon")).toBeInTheDocument();
    expect(within(sheet).getByText("Void: Entered twice")).toBeInTheDocument();
    expect(within(sheet).getByText("Refunded on", { selector: "dt" })).toBeInTheDocument();
    expect(within(sheet).queryByText("Reference", { selector: "dt" })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: /^Void/ })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole("link")).not.toBeInTheDocument();
  });

  it("says when a voider's account is gone, and offers Void refund on a refund held", () => {
    draw({ ...payment, kind: "REFUND", status: "VOID", void: { reason: "x", at: "2026-10-19T07:00:00Z", by: null } });
    expect(screen.getByText("Voided 19 Oct 2026")).toBeInTheDocument();
  });

  it("offers no Void without payments.edit, in a view-only clinic, or for an archived patient", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.view"] });
    const first = draw();
    expect(screen.queryByRole("button", { name: "Void payment" })).not.toBeInTheDocument();
    first.unmount();

    const stub = authStub({ role: "STAFF", permissions: EDITS });
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    const second = draw();
    expect(screen.queryByRole("button", { name: "Void payment" })).not.toBeInTheDocument();
    second.unmount();

    auth.current = stub;
    const third = draw({ ...payment, patient: { ...payment.patient, archived: true } }, false);
    expect(screen.queryByRole("button", { name: "Void payment" })).not.toBeInTheDocument();
    third.unmount();

    draw({ ...payment, kind: "REFUND" });
    expect(screen.getByRole("button", { name: "Void refund" })).toBeInTheDocument();
  });

  it("is nothing with no payment opened", () => {
    draw(null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
