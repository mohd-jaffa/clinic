import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Payment } from "@/features/billing/types";
import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client, revalidated } = vi.hoisted(() => ({ client: { voidPayment: vi.fn() }, revalidated: [] as unknown[] }));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: client }));
vi.mock("@/lib/query/useApiMutation", async (actual) => {
  const real = await actual<typeof import("@/lib/query/useApiMutation")>();
  return {
    useApiMutation: (action: never, options: { revalidate?: unknown[] }) => {
      revalidated.push(options.revalidate);
      return real.useApiMutation(action, options as never);
    },
  };
});

const { useVoidPayment } = await import("@/features/billing/hooks/useVoidPayment");

const payment = { id: "pay-1", kind: "PAYMENT", amountPaise: 50_000, patient: { id: "p-1" } } as Payment;
const onDone = vi.fn();

function Void({ of = payment }: { of?: Payment }) {
  const { void: voidIt, submitting } = useVoidPayment(of, onDone);
  return (
    <button type="button" aria-busy={submitting} onClick={() => void voidIt("Entered twice")}>
      Void
    </button>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  revalidated.length = 0;
});

describe("useVoidPayment (plan §15.3; D336)", () => {
  it("asks first on a coral card, voids with the reason, closes, and says the balance now", async () => {
    client.voidPayment.mockResolvedValue({ balancePaise: 50_000 });
    render(<Void />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Void" }));
    const card = await screen.findByRole("alertdialog", { name: "Void the payment of ₹500?" });
    await userEvent.click(within(card).getByRole("button", { name: "Void payment" }));
    await waitFor(() =>
      expect(client.voidPayment).toHaveBeenCalledWith({ paymentId: "pay-1", input: { reason: "Entered twice" } }),
    );
    expect((await screen.findAllByText("Payment voided"))[0]).toBeInTheDocument();
    expect(screen.getAllByText("Balance now: ₹500 due.")[0]).toBeInTheDocument();
    expect(onDone).toHaveBeenCalled();
    expect(revalidated[0]).toContain("/api/patients/p-1/summary");
  });

  it("asks of a refund in its own words, and voids nothing when kept", async () => {
    client.voidPayment.mockResolvedValue({ balancePaise: -20_000 });
    render(<Void of={{ ...payment, kind: "REFUND" }} />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Void" }));
    const card = await screen.findByRole("alertdialog", { name: "Void the refund of ₹500?" });
    await userEvent.click(within(card).getByRole("button", { name: "Keep it" }));
    expect(client.voidPayment).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Void" }));
    await userEvent.click(
      within(await screen.findByRole("alertdialog", { name: "Void the refund of ₹500?" })).getByRole("button", {
        name: "Void refund",
      }),
    );
    expect((await screen.findAllByText("Refund voided"))[0]).toBeInTheDocument();
  });

  it("says why it was not voided", async () => {
    client.voidPayment.mockRejectedValue(new ApiError(422, "PAYMENT_HAS_REFUNDS", "Void the refund first."));
    render(<Void />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Void" }));
    await userEvent.click(
      within(await screen.findByRole("alertdialog", { name: "Void the payment of ₹500?" })).getByRole("button", {
        name: "Void payment",
      }),
    );
    expect(await screen.findByRole("alertdialog", { name: "It wasn’t voided" })).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
