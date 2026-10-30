import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReceiptLink } from "@/features/documents/components/ReceiptLink";

describe("ReceiptLink (D393, D395)", () => {
  it("opens the receipt itself beside the app, named by its number", () => {
    render(<ReceiptLink href="/api/subscription/payments/sp-1/receipt.pdf" number="R/2026-27/0001" />);
    const link = screen.getByRole("link", { name: "Receipt R/2026-27/0001" });
    expect(link).toHaveAttribute("href", "/api/subscription/payments/sp-1/receipt.pdf");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveTextContent("Receipt");
  });
});
