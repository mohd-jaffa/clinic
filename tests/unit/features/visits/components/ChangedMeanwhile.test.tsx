import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChangedMeanwhile } from "@/features/visits/components/ChangedMeanwhile";

describe("ChangedMeanwhile (D206)", () => {
  it("says someone saved meanwhile, shows theirs, and takes theirs on Use theirs", async () => {
    const onTake = vi.fn();
    render(
      <ChangedMeanwhile onTake={onTake}>
        <p>Viral fever</p>
      </ChangedMeanwhile>,
    );
    const notice = screen.getByRole("status");
    expect(within(notice).getByText("Someone saved this meanwhile")).toBeInTheDocument();
    expect(within(notice).getByText("Theirs is below. Save to keep yours instead, or use theirs.")).toBeInTheDocument();
    expect(within(notice).getByText("Viral fever")).toBeInTheDocument();
    await userEvent.click(within(notice).getByRole("button", { name: "Use theirs" }));
    expect(onTake).toHaveBeenCalledOnce();
  });
});
