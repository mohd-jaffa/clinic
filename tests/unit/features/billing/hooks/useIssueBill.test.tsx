import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BillStart } from "@/features/billing/types";
import { ApiError } from "@/lib/api/client";
import type { BillInput } from "@/lib/validation";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { client, auth } = vi.hoisted(() => ({
  client: { issue: vi.fn() },
  auth: { current: {} as ReturnType<typeof authStub> },
}));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: client }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { useIssueBill } = await import("@/features/billing/hooks/useIssueBill");

const start = { patient: { id: "p-1" }, visit: { id: "v-1" }, appointment: null } as unknown as BillStart;
const input = { patientId: "p-1" } as unknown as BillInput;
const onIssued = vi.fn();

function Issue() {
  const { issue, issuing } = useIssueBill(start, onIssued);
  return (
    <button type="button" aria-busy={issuing} onClick={() => void issue(input)}>
      Issue
    </button>
  );
}

/** A notice is shown, and announced: its words are found twice. */
const notice = async (text: string) => (await screen.findAllByText(text))[0];

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.view", "payments.create"] });
});

describe("useIssueBill (plan §15.2; D302, D312, D317)", () => {
  it("issues once per key, takes the person on, and says what was issued and collected — with Print and View bill", async () => {
    const issued = {
      billId: "b-1",
      billNumber: "2026-27/0042",
      totalPaise: 50_000,
      collectedPaise: 50_000,
      balancePaise: 0,
    };
    client.issue.mockResolvedValue(issued);
    render(<Issue />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Issue" }));
    await userEvent.click(screen.getByRole("button", { name: "Issue" }));
    const [first, second] = client.issue.mock.calls.map(([sent]) => sent as { input: BillInput; key: string });
    expect(first.input).toBe(input);
    // Issued, the next one is a bill of its own.
    expect(second.key).not.toBe(first.key);
    expect(await notice("Bill 2026-27/0042 issued")).toBeInTheDocument();
    expect(screen.getAllByText("₹500 collected")[0]).toBeInTheDocument();
    expect(onIssued).toHaveBeenCalledWith(issued);
    // It stays up with the bill's PDF, opened beside the app, and its page (D317).
    const card = screen.getByRole("dialog", { name: "Bill 2026-27/0042 issued" });
    expect(within(card).getByRole("link", { name: "Print" })).toHaveAttribute("href", "/api/bills/b-1/bill.pdf");
    expect(within(card).getByRole("link", { name: "Print" })).toHaveAttribute("target", "_blank");
    expect(within(card).getByRole("link", { name: "View bill" })).toHaveAttribute("href", "/bills/b-1");
  });

  it("says nothing of collecting when nothing was", async () => {
    client.issue.mockResolvedValue({ billId: "b-1", billNumber: "2026-27/0043", collectedPaise: 0 });
    render(<Issue />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Issue" }));
    expect(await notice("Bill 2026-27/0043 issued")).toBeInTheDocument();
    expect(screen.queryByText(/collected/)).not.toBeInTheDocument();
  });

  it("offers neither Print nor View bill to whoever may not read bills", async () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.create"] });
    client.issue.mockResolvedValue({ billId: "b-1", billNumber: "2026-27/0044", collectedPaise: 0 });
    render(<Issue />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Issue" }));
    expect(await notice("Bill 2026-27/0044 issued")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View bill" })).not.toBeInTheDocument();
  });

  it("says why it was not issued, sending the same key with Try again", async () => {
    client.issue.mockRejectedValue(new ApiError(422, "BILL_PRICE_NOT_ALLOWED", "A price here isn’t the price list’s."));
    render(<Issue />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Issue" }));
    expect(await screen.findByRole("alertdialog", { name: "The bill wasn’t issued" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Issue" }));
    const [first, second] = client.issue.mock.calls.map(([sent]) => sent as { key: string });
    expect(second.key).toBe(first.key);
    expect(onIssued).not.toHaveBeenCalled();
  });
});
