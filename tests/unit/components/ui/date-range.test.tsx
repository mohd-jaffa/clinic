import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DateRangeFilter } from "@/components/ui/date-range";
import type { DateRange } from "@/lib/dates/range";

const seen = vi.fn();

function Filter({ start }: { start: DateRange }) {
  const [range, setRange] = useState(start);
  return (
    <DateRangeFilter
      value={range}
      onChange={(next) => {
        seen(next);
        setRange(next);
      }}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date("2026-10-19T06:00:00Z"), toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DateRangeFilter (D320)", () => {
  it("picks today, the last 7 days or this month by a chip", async () => {
    render(<Filter start={{ kind: "TODAY", from: "2026-10-19", to: "2026-10-19" }} />);
    expect(screen.getByRole("radio", { name: "Today" })).toBeChecked();
    expect(screen.queryByText("From")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "7 days" }));
    expect(seen).toHaveBeenLastCalledWith({ kind: "WEEK", from: "2026-10-13", to: "2026-10-19" });
    await userEvent.click(screen.getByRole("radio", { name: "This month" }));
    expect(seen).toHaveBeenLastCalledWith({ kind: "MONTH", from: "2026-10-01", to: "2026-10-19" });
  });

  it("picks From – To, starting from the days the chip stood for", async () => {
    render(<Filter start={{ kind: "WEEK", from: "2026-10-13", to: "2026-10-19" }} />);
    await userEvent.click(screen.getByRole("radio", { name: "Pick dates" }));
    expect(seen).toHaveBeenLastCalledWith({ kind: "CUSTOM", from: "2026-10-13", to: "2026-10-19" });
    await userEvent.click(screen.getByLabelText(/^From/, { selector: "button" }));
    await userEvent.click(screen.getByRole("button", { name: "Saturday, 10 Oct 2026" }));
    expect(seen).toHaveBeenLastCalledWith({ kind: "CUSTOM", from: "2026-10-10", to: "2026-10-19" });
    await userEvent.click(screen.getByLabelText(/^To/, { selector: "button" }));
    await userEvent.click(screen.getByRole("button", { name: "Thursday, 15 Oct 2026" }));
    expect(seen).toHaveBeenLastCalledWith({ kind: "CUSTOM", from: "2026-10-10", to: "2026-10-15" });
  });
});
