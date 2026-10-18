import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BillStart } from "@/features/billing/types";
import { ApiError } from "@/lib/api/client";
import type { BillInput } from "@/lib/validation";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { issue: vi.fn() } }));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: client }));

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

beforeEach(() => vi.clearAllMocks());

describe("useIssueBill (plan §15.2; D302, D312)", () => {
  it("issues once per key, takes the person on, and says what was issued and collected", async () => {
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
  });

  it("says nothing of collecting when nothing was", async () => {
    client.issue.mockResolvedValue({ billId: "b-1", billNumber: "2026-27/0043", collectedPaise: 0 });
    render(<Issue />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Issue" }));
    expect(await notice("Bill 2026-27/0043 issued")).toBeInTheDocument();
    expect(screen.queryByText(/collected/)).not.toBeInTheDocument();
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
