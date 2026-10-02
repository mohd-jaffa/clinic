import { render, screen } from "@testing-library/react";
import { ReceiptText } from "lucide-react";
import { describe, expect, it } from "vitest";

import { Pin } from "@/components/ui/pin";

describe("Pin", () => {
  it("carries the one thing not to miss, in coral", () => {
    render(<Pin label="Allergy: Penicillin" />);
    expect(screen.getByText("Allergy: Penicillin").parentElement).toHaveClass("bg-coral");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("opens where that thing is dealt with, its mark hidden from a screen reader", () => {
    render(<Pin label="3 to bill" icon={ReceiptText} href="/billing" />);
    const link = screen.getByRole("link", { name: "3 to bill" });
    expect(link).toHaveAttribute("href", "/billing");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
