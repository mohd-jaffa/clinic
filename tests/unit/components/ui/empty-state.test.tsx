import { render, screen } from "@testing-library/react";
import { Users } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
  it("says what is missing, why it is worth having, and the one action that starts it", () => {
    render(
      <EmptyState
        icon={Users}
        title="No patients yet"
        hint="Everyone you see will be here, with their visits and bills."
        action={<button type="button">Add a patient</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No patients yet" })).toBeInTheDocument();
    expect(screen.getByText("Everyone you see will be here, with their visits and bills.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a patient" })).toBeInTheDocument();
  });

  it("sits its mark on a small lobe of land, unseen by a screen reader", () => {
    const { container } = render(<EmptyState icon={Users} title="No patients yet" />);
    const lobe = container.querySelector("[aria-hidden='true']")!;
    expect(lobe).toHaveClass("rounded-lobe", "bg-land");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
