import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OwingPill } from "@/features/billing/components/OwingPill";

describe("OwingPill (plan §10.2; D101)", () => {
  it("says what a patient owes, and nothing when they owe nothing or hold an advance", () => {
    const { container, rerender } = render(<OwingPill balancePaise={120_000} />);
    expect(screen.getByText("₹1,200 due")).toBeInTheDocument();
    rerender(<OwingPill balancePaise={0} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<OwingPill balancePaise={-5_000} />);
    expect(container).toBeEmptyDOMElement();
  });
});
