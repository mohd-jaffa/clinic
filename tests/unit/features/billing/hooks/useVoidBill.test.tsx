import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BillDetail } from "@/features/billing/types";
import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client, revalidated } = vi.hoisted(() => ({ client: { void: vi.fn() }, revalidated: [] as unknown[] }));
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

const { useVoidBill } = await import("@/features/billing/hooks/useVoidBill");

const bill = {
  id: "b-1",
  number: "2026-27/0042",
  patient: { id: "p-1" },
  visitId: "v-1",
  appointmentId: null,
} as BillDetail;
const onDone = vi.fn();

function Void() {
  const { void: voidIt, submitting } = useVoidBill(bill, onDone);
  return (
    <button type="button" aria-busy={submitting} onClick={() => void voidIt("Wrong patient")}>
      Void
    </button>
  );
}

const ask = () => screen.findByRole("alertdialog", { name: "Void bill 2026-27/0042?" });

beforeEach(() => {
  vi.clearAllMocks();
  revalidated.length = 0;
});

describe("useVoidBill (plan §15.2; D314)", () => {
  it("asks first on a coral card, voids with the reason, closes, and says its visit is back in To bill", async () => {
    client.void.mockResolvedValue({ balancePaise: 0, visitToBill: true });
    render(<Void />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Void" }));
    const card = await ask();
    expect(card).toHaveTextContent("It stays on record, marked Void, and leaves the balance.");
    await userEvent.click(within(card).getByRole("button", { name: "Void bill" }));
    await waitFor(() =>
      expect(client.void).toHaveBeenCalledWith({ billId: "b-1", input: { reason: "Wrong patient" } }),
    );
    expect((await screen.findAllByText("Bill 2026-27/0042 voided"))[0]).toBeInTheDocument();
    expect(screen.getAllByText("Its visit is back in To bill.")[0]).toBeInTheDocument();
    expect(onDone).toHaveBeenCalled();
    expect(revalidated[0]).toContain("/api/bills/b-1");
  });

  it("voids nothing when kept, and says nothing of To bill when no visit moved", async () => {
    client.void.mockResolvedValue({ balancePaise: 0, visitToBill: false });
    render(<Void />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Void" }));
    await userEvent.click(within(await ask()).getByRole("button", { name: "Keep it" }));
    expect(client.void).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Void" }));
    await userEvent.click(within(await ask()).getByRole("button", { name: "Void bill" }));
    expect((await screen.findAllByText("Bill 2026-27/0042 voided"))[0]).toBeInTheDocument();
    expect(screen.queryByText("Its visit is back in To bill.")).not.toBeInTheDocument();
  });

  it("says why it was not voided", async () => {
    client.void.mockRejectedValue(new ApiError(403, "AUTH_PERMISSION_DENIED", "You don’t have permission."));
    render(<Void />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Void" }));
    await userEvent.click(within(await ask()).getByRole("button", { name: "Void bill" }));
    expect(await screen.findByRole("alertdialog", { name: "The bill wasn’t voided" })).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
