import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CalendarGrid, lanesOf, type GridColumn, type GridItem } from "@/components/ui/calendar-grid";

describe("lanesOf", () => {
  it("lays overlapping items side by side, each in the first lane free, as wide as their busiest moment allows", () => {
    const placed = lanesOf(
      [
        { key: "a", start: 540, end: 570 },
        { key: "b", start: 555, end: 585 },
        { key: "c", start: 570, end: 600 },
        { key: "d", start: 660, end: 675 },
      ],
      15,
    );
    expect(Object.fromEntries(placed)).toEqual({
      a: { lane: 0, lanes: 2 },
      b: { lane: 1, lanes: 2 },
      c: { lane: 0, lanes: 2 },
      d: { lane: 0, lanes: 1 },
    });
  });

  it("puts the shorter of two starting together first", () => {
    const placed = lanesOf(
      [
        { key: "long", start: 540, end: 600 },
        { key: "short", start: 540, end: 555 },
      ],
      15,
    );
    expect(placed.get("short")).toEqual({ lane: 0, lanes: 2 });
    expect(placed.get("long")).toEqual({ lane: 1, lanes: 2 });
  });

  it("holds a short item a whole step tall, so the next never lies over it", () => {
    const placed = lanesOf(
      [
        { key: "short", start: 540, end: 545 },
        { key: "next", start: 550, end: 560 },
      ],
      15,
    );
    expect(placed.get("next")).toEqual({ lane: 1, lanes: 2 });
  });
});

const columns: GridColumn[] = [
  { key: "d-1", title: "Maya Rao", pickableFrom: 600 },
  { key: "d-2", title: "Arun Sen", closed: "Away: Conference" },
  { key: "d-3", title: "Asha Menon", subtitle: "Today", today: true },
];
const items: GridItem[] = [
  { key: "a-1", column: "d-1", start: 540, end: 555, label: "9:00 AM – 9:15 AM, Rohan Mehta", content: <b>Rohan</b> },
  { key: "a-2", column: "d-3", start: 600, end: 660, label: "10:00 AM – 11:00 AM, Anita Rao", content: <b>Anita</b> },
];
const draw = (onPick?: (column: string, minutes: number) => void, width?: "wide" | "narrow") =>
  render(
    <CalendarGrid
      label="Appointments, Tuesday, 13 Oct 2026"
      columns={columns}
      from={480}
      to={720}
      step={15}
      items={items}
      onPick={onPick}
      columnWidth={width}
    />,
  );

describe("CalendarGrid (D66)", () => {
  it("lists each column's items at their times, said whole, under its title — the hours down the side", () => {
    const { container } = draw();
    const grid = screen.getByRole("region", { name: "Appointments, Tuesday, 13 Oct 2026" });
    const maya = within(grid).getByRole("list", { name: "Maya Rao" });
    const rohan = within(maya).getByRole("listitem");
    expect(rohan).toHaveTextContent("9:00 AM – 9:15 AM, Rohan Mehta");
    expect(rohan).toHaveStyle({ top: "96px", height: "24px", left: "0%", width: "100%" });
    expect(within(within(grid).getByRole("list", { name: "Asha Menon" })).getByRole("listitem")).toHaveStyle({
      top: "192px",
      height: "96px",
    });
    expect(within(grid).getByRole("list", { name: "Arun Sen" })).toBeEmptyDOMElement();
    expect(container).toHaveTextContent("8 AM9 AM10 AM11 AM");
    expect(grid.querySelector('[aria-current="date"]')).toHaveTextContent("Asha MenonToday");
    expect(screen.getByText("Away: Conference")).toBeInTheDocument();
    expect((grid.firstElementChild as HTMLElement).style.gridTemplateColumns).toBe(
      "4rem repeat(3, minmax(10rem, 1fr))",
    );
  });

  it("starts something at an empty step tapped — never on a closed column, nor before a column's first", () => {
    const onPick = vi.fn();
    draw(onPick, "narrow");
    expect((screen.getByRole("region").firstElementChild as HTMLElement).style.gridTemplateColumns).toBe(
      "4rem repeat(3, minmax(7.5rem, 1fr))",
    );
    const [maya, arun, asha] = screen
      .getByRole("region")
      .querySelectorAll<HTMLElement>(".relative.border-l > [aria-hidden='true']");
    fireEvent.click(maya.children[8] as HTMLElement);
    expect(onPick).toHaveBeenLastCalledWith("d-1", 600);
    expect(maya.children[8]).toHaveTextContent("10:00 AM");
    fireEvent.click(maya.children[7] as HTMLElement);
    fireEvent.click(arun.children[8] as HTMLElement);
    expect(onPick).toHaveBeenCalledTimes(1);
    fireEvent.click(asha.children[1] as HTMLElement);
    expect(onPick).toHaveBeenLastCalledWith("d-3", 495);
  });

  it("takes no tap anywhere without onPick", () => {
    draw();
    const [maya] = screen
      .getByRole("region")
      .querySelectorAll<HTMLElement>(".relative.border-l > [aria-hidden='true']");
    expect(maya.children[8]).toBeEmptyDOMElement();
    expect(maya.children[8]).not.toHaveClass("cursor-pointer");
  });
});
