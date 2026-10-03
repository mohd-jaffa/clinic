import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { COASTLINES } from "@/assets/coastlines";
import { CoastHeader, Coastline } from "@/components/ui/coast-header";
import { Pin } from "@/components/ui/pin";

describe("Coastline", () => {
  it("draws an authored path, stretched to its width with its height kept, unseen by a screen reader", () => {
    const { container } = render(<Coastline name="band" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", "0 0 1200 12");
    expect(svg).toHaveAttribute("preserveAspectRatio", "none");
    expect(svg).toHaveStyle({ height: "12px" });
    expect(svg.querySelector("path")).toHaveAttribute("d", COASTLINES.band.d);
  });

  it("runs down instead, its width kept, for land that stands beside the ground", () => {
    const { container } = render(<Coastline name="side" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("viewBox", "0 0 34 1200");
    expect(svg).toHaveStyle({ width: "34px" });
    expect(svg).toHaveClass("h-full");
  });

  it("turns over for land that rises from below", () => {
    const { container } = render(<Coastline name="phone" flip />);
    expect(container.querySelector("svg")).toHaveClass("-scale-y-100");
  });
});

describe("CoastHeader", () => {
  it("leads with land holding the key fact, edged by the phone's coast and the wide one", () => {
    const { container } = render(
      <CoastHeader>
        <h1>Today&apos;s queue</h1>
      </CoastHeader>,
    );
    expect(screen.getByRole("heading", { name: "Today's queue" }).parentElement).toHaveClass("bg-land");
    const shapes = [...container.querySelectorAll("path")].map((path) => path.getAttribute("d"));
    expect(shapes).toEqual([COASTLINES.phone.d, COASTLINES.wide.d]);
  });

  it("keeps a slim band on a dense screen, with the one thing not to miss pinned on its coast", () => {
    const { container } = render(
      <CoastHeader size="band" pin={<Pin label="Allergy: Penicillin" />}>
        <p>Rohan Mehta</p>
      </CoastHeader>,
    );
    expect([...container.querySelectorAll("path")].map((path) => path.getAttribute("d"))).toEqual([COASTLINES.band.d]);
    expect(screen.getByText("Allergy: Penicillin").closest("div")).toHaveClass("absolute", "-top-2.5");
  });

  it("pins on the lead coast too", () => {
    render(
      <CoastHeader pin={<Pin label="3 to bill" />}>
        <p>Queue</p>
      </CoastHeader>,
    );
    expect(screen.getByText("3 to bill").closest("div")).toHaveClass("top-1");
  });
});
