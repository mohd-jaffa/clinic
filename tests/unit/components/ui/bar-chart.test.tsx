import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { BarChart, niceCeiling, type BarPoint } from "@/components/ui/bar-chart";

const POINTS: BarPoint[] = [
  { label: "1", name: "Thu 1 Oct", up: 1_200, down: 900 },
  { label: "2", name: "Fri 2 Oct", up: 0, down: 0 },
  { label: "3", name: "Sat 3 Oct", up: 4_000, down: 0 },
];
const TEXT = {
  keys: "Use the arrow keys.",
  showTable: "Show as table",
  hideTable: "Hide table",
  table: "Table",
  column: "Day",
};
const draw = (points: BarPoint[] = POINTS, hint?: string) =>
  render(
    <BarChart
      title="Collected and expenses by day"
      hint={hint}
      points={points}
      upName="Collected"
      downName="Expenses"
      format={(value) => `₹${value}`}
      formatAxis={(value) => `${value}`}
      text={TEXT}
      tickEvery={2}
    />,
  );
const plot = () => screen.getByRole("group", { name: "Collected and expenses by day. Use the arrow keys." });
const readout = () => screen.getByText((_, element) => element?.getAttribute("aria-live") === "polite");
const columns = () => Array.from(document.querySelectorAll("[data-column]"));

describe("niceCeiling", () => {
  it("rounds up to 1, 2 or 5 times a power of ten, and nothing to nothing", () => {
    expect([0, -5, 1, 3, 7, 10, 12, 4_000, 9_001].map(niceCeiling)).toEqual([0, 0, 1, 5, 10, 10, 20, 5_000, 10_000]);
  });
});

describe("BarChart (plan §18; D66, D354)", () => {
  it("names itself and its two series, rising above the line and falling below it on one axis", () => {
    draw(POINTS, "Collected above the line, expenses below");
    expect(screen.getByRole("figure", { name: "Collected and expenses by day" })).toBeInTheDocument();
    expect(screen.getByText("Collected above the line, expenses below")).toBeInTheDocument();
    expect(screen.getByRole("list")).toHaveTextContent("CollectedExpenses");
    // Up to 5,000 and down to 1,000 on one axis: the line at five sixths of the plot.
    const [first, empty, third] = columns().map((column) => Array.from(column.children) as HTMLElement[]);
    expect(first[0].style).toMatchObject({ bottom: `${100 - (5_000 / 6_000) * 100}%`, height: "20%" });
    expect(first[1].style).toMatchObject({ top: `${(5_000 / 6_000) * 100}%`, height: "15%" });
    expect(empty).toHaveLength(0);
    expect(third).toHaveLength(1);
    expect(screen.getByText("5000")).toBeInTheDocument();
    expect(screen.getByText("1000")).toBeInTheDocument();
    // Every second day named under the axis.
    expect(screen.getAllByText(/^[13]$/)).toHaveLength(2);
  });

  it("reads out the column pointed at, and nothing once the pointer leaves", () => {
    draw();
    fireEvent.pointerEnter(columns()[0]);
    expect(readout()).toHaveTextContent("Thu 1 Oct · Collected ₹1200 · Expenses ₹900");
    fireEvent.pointerDown(columns()[2]);
    expect(readout()).toHaveTextContent("Sat 3 Oct · Collected ₹4000 · Expenses ₹0");
    fireEvent.pointerLeave(plot());
    expect(readout()).toHaveTextContent("");
  });

  it("is read a column at a time with the arrow keys, from the latest", async () => {
    draw();
    await userEvent.tab();
    expect(plot()).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(readout()).toHaveTextContent("Fri 2 Oct");
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(readout()).toHaveTextContent("Sat 3 Oct");
    await userEvent.keyboard("{Home}");
    expect(readout()).toHaveTextContent("Thu 1 Oct");
    await userEvent.keyboard("{ArrowLeft}");
    expect(readout()).toHaveTextContent("Thu 1 Oct");
    await userEvent.keyboard("{End}");
    expect(readout()).toHaveTextContent("Sat 3 Oct");
    await userEvent.keyboard("a");
    expect(readout()).toHaveTextContent("Sat 3 Oct");
    await userEvent.keyboard("{Escape}");
    expect(readout()).toHaveTextContent("");
    await userEvent.keyboard("{ArrowRight}");
    expect(readout()).toHaveTextContent("Sat 3 Oct");
    await userEvent.tab();
    expect(readout()).toHaveTextContent("");
  });

  it("holds every value in a table behind Show as table", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Show as table" }));
    const table = screen.getByRole("table", { name: "Collected and expenses by day" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Day", "Collected", "Expenses"]);
    expect(within(table).getByRole("row", { name: "Thu 1 Oct ₹1200 ₹900" })).toBeInTheDocument();
  });

  it("keeps its line at the foot when nothing went out, and draws no columns with nothing at all", () => {
    const { unmount } = draw([{ label: "1", name: "Thu 1 Oct", up: 300, down: 0 }]);
    expect(screen.queryByText("1000")).not.toBeInTheDocument();
    unmount();
    draw([{ label: "1", name: "Thu 1 Oct", up: 0, down: 0 }]);
    expect(columns()[0].children).toHaveLength(0);
    expect(screen.getAllByText("0")).toHaveLength(2);
  });
});
