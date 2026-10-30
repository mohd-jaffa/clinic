import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlanHistory } from "@/features/subscription/components/PlanHistory";
import { aPlanPayment } from "@tests/support/plan";

describe("PlanHistory (plan §7.5; D366, D393)", () => {
  it("lists every change to the plan's last day, the latest first: how it was paid, or why at no charge", () => {
    render(
      <PlanHistory
        payments={[
          aPlanPayment({
            id: "sp-3",
            kind: "YEARLY",
            amountPaise: 300_000,
            method: "BANK_TRANSFER",
            validUntil: "2027-11-12",
            paidOn: "2026-11-10",
            reference: null,
            receiptNumber: "R/2026-27/0002",
          }),
          aPlanPayment(),
          aPlanPayment({
            id: "sp-1",
            kind: "CUSTOM",
            amountPaise: 0,
            method: null,
            reference: null,
            paidOn: null,
            validUntil: "2026-10-12",
            reason: "Ten days for the move",
            recordedOn: "2026-10-03",
            receiptNumber: null,
          }),
        ]}
      />,
    );
    expect(screen.getByRole("region", { name: "History" })).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Until 12 Nov 2027Yearly · Paid 10 Nov 2026 · Bank transferReceipt₹3,000",
      "Until 12 Nov 2026Monthly · Paid 12 Oct 2026 · UPI · UPI-4821Receipt₹300",
      "Until 12 Oct 2026Date changed · 3 Oct 2026 · Ten days for the moveNo charge",
    ]);
    // Money received opens its receipt in the browser's own viewer (D393); a change at no charge has none.
    const receipt = within(rows[0]).getByRole("link", { name: "Receipt R/2026-27/0002" });
    expect(receipt).toHaveAttribute("href", "/api/subscription/payments/sp-3/receipt.pdf");
    expect(receipt).toHaveAttribute("target", "_blank");
    expect(within(rows[2]).queryByRole("link")).not.toBeInTheDocument();
  });

  it("says when nothing has been recorded yet", () => {
    render(<PlanHistory payments={[]} />);
    expect(screen.getByText("Nothing recorded yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
