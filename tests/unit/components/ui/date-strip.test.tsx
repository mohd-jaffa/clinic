import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DateStrip } from "@/components/ui/date-strip";

const DAYS = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];

function Days({ onChange = vi.fn() }: { onChange?: (day: string) => void }) {
  const [day, setDay] = useState("2026-10-02");
  return (
    <DateStrip
      label="Day"
      value={day}
      days={DAYS}
      onChange={(next) => {
        setDay(next);
        onChange(next);
      }}
    />
  );
}

describe("DateStrip", () => {
  beforeEach(() => {
    // Noon on 2 Oct 2026 in Kolkata.
    vi.useFakeTimers({ now: new Date("2026-10-02T06:30:00Z"), toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers each day by its weekday and date, read in full, today marked", () => {
    render(<Days />);
    expect(screen.getByRole("radiogroup", { name: "Day" })).toBeInTheDocument();
    const today = screen.getByRole("radio", { name: "Friday, 2 Oct 2026" });
    expect(today).toHaveAttribute("aria-checked", "true");
    expect(today).toHaveAttribute("aria-current", "date");
    expect(today).toHaveTextContent("Fri2");
    expect(screen.getByRole("radio", { name: "Thursday, 1 Oct 2026" })).not.toHaveAttribute("aria-current");
  });

  it("rings today when another day is chosen", async () => {
    render(<Days />);
    await userEvent.click(screen.getByRole("radio", { name: "Sunday, 4 Oct 2026" }));
    expect(screen.getByRole("radio", { name: "Friday, 2 Oct 2026" })).toHaveClass("ring-action");
    expect(screen.getByRole("radio", { name: "Sunday, 4 Oct 2026" })).toHaveClass("bg-chip");
  });

  it("moves the choice with the arrow keys, keeping it in view", async () => {
    const onChange = vi.fn();
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    render(<Days onChange={onChange} />);
    screen.getByRole("radio", { name: "Friday, 2 Oct 2026" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("2026-10-03");
    expect(screen.getByRole("radio", { name: "Saturday, 3 Oct 2026" })).toHaveFocus();
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest", inline: "nearest" });
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  });
});
