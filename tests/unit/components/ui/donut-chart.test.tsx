import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DonutChart, type DonutPart } from "@/components/ui/donut-chart";

const PARTS: DonutPart[] = [
  { key: "COMPLETED", label: "Completed", value: 6, tone: "action" },
  { key: "STILL_TO_COME", label: "Still to come", value: 0, tone: "ink" },
  { key: "NO_SHOW", label: "No-shows", value: 1, tone: "coral" },
  { key: "CANCELLED", label: "Cancelled", value: 1, tone: "edge" },
];
const draw = (parts: DonutPart[] = PARTS) =>
  render(
    <DonutChart
      title="Appointment outcomes"
      parts={parts}
      total={(count) => `${count} in all`}
      empty="No appointments this month."
      share={(count, percent) => `${count} · ${percent}%`}
    />,
  );
const segments = () => Array.from(document.querySelectorAll("circle"));

describe("DonutChart (plan §18; D66, D355)", () => {
  it("rings the parts from the top in their order, each parted by a gap, the whole in the middle", () => {
    draw();
    expect(screen.getByRole("figure", { name: "Appointment outcomes" })).toBeInTheDocument();
    expect(screen.getByText("8 in all")).toBeInTheDocument();
    // A part with none is left out of the ring.
    expect(segments().map((circle) => circle.dataset.part)).toEqual(["COMPLETED", "NO_SHOW", "CANCELLED"]);
    const ring = 2 * Math.PI * 48;
    const [done, noShow] = segments();
    expect(done.getAttribute("stroke-dasharray")).toBe(`${ring * 0.75 - 2} ${ring - (ring * 0.75 - 2)}`);
    expect(done.getAttribute("stroke-dashoffset")).toBe("0");
    expect(noShow.getAttribute("stroke-dashoffset")).toBe(String(-ring * 0.75));
    expect(done).toHaveClass("stroke-action");
    expect(noShow).toHaveClass("stroke-coral");
  });

  it("names every part in its legend with its count and share, a part with none included", () => {
    draw();
    const legend = screen.getByRole("list", { name: "Appointment outcomes" });
    expect(
      within(legend)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Completed6 · 75%", "Still to come0 · 0%", "No-shows1 · 13%", "Cancelled1 · 13%"]);
  });

  it("draws a lone part as the whole ring, and says so when there is nothing", () => {
    const { unmount } = draw([{ key: "COMPLETED", label: "Completed", value: 3, tone: "action" }]);
    const ring = 2 * Math.PI * 48;
    expect(segments()[0].getAttribute("stroke-dasharray")).toBe(`${ring} 0`);
    unmount();
    draw(PARTS.map((part) => ({ ...part, value: 0 })));
    expect(screen.getByText("No appointments this month.")).toBeInTheDocument();
    expect(segments()).toHaveLength(0);
  });
});
