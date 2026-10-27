import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FigureSection, ReportFrame } from "@/features/reports/components/ReportFrame";
import { Providers } from "@tests/support/providers";

type Report = { day: string };
const draw = (query: { data?: Report; error?: unknown; mutate?: () => void }, day = "2026-10-27") =>
  render(
    <ReportFrame query={{ isLoading: false, ...query }} current={(report: Report) => report.day === day}>
      {(report) => <p>{`Figures of ${report.day}`}</p>}
    </ReportFrame>,
    { wrapper: Providers },
  );

describe("ReportFrame (plan §18)", () => {
  it("waits with skeletons the first time", () => {
    draw({});
    expect(screen.getByRole("region", { name: "Loading…" })).toHaveAttribute("aria-busy", "true");
  });

  it("shows the report asked for, and keeps the last one dimmed while the next is read", () => {
    const { unmount } = draw({ data: { day: "2026-10-27" } });
    expect(screen.getByText("Figures of 2026-10-27").parentElement).toHaveAttribute("aria-busy", "false");
    unmount();
    draw({ data: { day: "2026-10-26" } });
    const kept = screen.getByText("Figures of 2026-10-26").parentElement!;
    expect(kept).toHaveAttribute("aria-busy", "true");
    expect(kept).toHaveClass("opacity-60");
  });

  it("says when the report could not be read, the first time or for the next one, and tries again", async () => {
    const mutate = vi.fn();
    const { unmount } = draw({ error: new Error("down"), mutate });
    expect(screen.getByText("This report couldn't be loaded.")).toBeInTheDocument();
    unmount();
    draw({ data: { day: "2026-10-26" }, error: new Error("down"), mutate });
    expect(screen.queryByText("Figures of 2026-10-26")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalled();
  });
});

describe("FigureSection (plan §18)", () => {
  it("sets the figures side by side under their heading", () => {
    render(<FigureSection title="Money" figures={[{ label: "Collected", value: "₹500" }]} />);
    expect(screen.getByRole("region", { name: "Money" })).toHaveTextContent("MoneyCollected₹500");
  });
});
