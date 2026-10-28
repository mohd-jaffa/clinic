import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlanHistory } from "@/features/subscription/components/PlanHistory";
import { aPlanPayment } from "@tests/support/plan";

describe("PlanHistory (plan §7.5; D366)", () => {
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
          }),
        ]}
      />,
    );
    expect(screen.getByRole("region", { name: "History" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      "Until 12 Nov 2027Yearly · Paid 10 Nov 2026 · Bank transfer₹3,000",
      "Until 12 Nov 2026Monthly · Paid 12 Oct 2026 · UPI · UPI-4821₹300",
      "Until 12 Oct 2026Date changed · 3 Oct 2026 · Ten days for the moveNo charge",
    ]);
  });

  it("says when nothing has been recorded yet", () => {
    render(<PlanHistory payments={[]} />);
    expect(screen.getByText("Nothing recorded yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
