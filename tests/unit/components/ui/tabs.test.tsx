import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TabPanel, Tabs } from "@/components/ui/tabs";

const OPTIONS = [
  { value: "visits", label: "Visits" },
  { value: "treatments", label: "Treatments", count: 12 },
  { value: "bills", label: "Bills" },
] as const;

function Screen({ start = "visits" }: { start?: string }) {
  const [tab, setTab] = useState(start as (typeof OPTIONS)[number]["value"]);
  return (
    <>
      <Tabs id="patient" label="Patient views" value={tab} options={OPTIONS} onChange={setTab} />
      <TabPanel id="patient" value={tab}>
        Showing {tab}
      </TabPanel>
    </>
  );
}

describe("Tabs", () => {
  it("is a tablist whose chosen tab names the panel it shows", () => {
    render(<Screen />);
    expect(screen.getByRole("tablist", { name: "Patient views" })).toBeInTheDocument();
    const overview = screen.getByRole("tab", { name: "Visits" });
    expect(overview).toHaveAttribute("aria-selected", "true");

    const panel = screen.getByRole("tabpanel", { name: "Visits" });
    expect(panel).toHaveTextContent("Showing visits");
    expect(overview).toHaveAttribute("aria-controls", panel.id);
  });

  it("shows a count beside a tab's name", () => {
    render(<Screen />);
    expect(screen.getByRole("tab", { name: "Treatments 12" })).toBeInTheDocument();
  });

  it("switches by a tap, or by the arrow keys as it goes", async () => {
    render(<Screen />);
    await userEvent.click(screen.getByRole("tab", { name: "Bills" }));
    expect(screen.getByRole("tabpanel", { name: "Bills" })).toHaveTextContent("Showing bills");

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Treatments 12" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Showing treatments");
    expect(screen.getByRole("tab", { name: "Treatments 12" }).querySelector("span")).toHaveClass("bg-chip");
  });
});

// jsdom lays nothing out: each tab is 80 px wide, 100 px from the last.
function layTabsOut() {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(80);
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
    return (
      [...(this.parentElement?.children ?? [])].filter((child) => child.getAttribute("role") === "tab").indexOf(this) *
      100
    );
  });
}

const underline = () => screen.getByRole("tablist").querySelector<HTMLElement>('span[aria-hidden="true"]')!;

describe("Tabs' underline", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sits under the chosen tab, then glides to the next one chosen", async () => {
    layTabsOut();
    render(<Screen />);
    // 60 px long, drawn by scaling rather than by width (no layout while it glides).
    expect(underline()).toHaveStyle({ width: "100px", transform: "translateX(10px) scaleX(0.6)" });
    expect(underline().style.transition).toBe("");

    await userEvent.click(screen.getByRole("tab", { name: "Bills" }));
    expect(underline()).toHaveStyle({ transform: "translateX(210px) scaleX(0.6)" });
    expect(underline().style.transition).toBe("");
  });

  it("is hidden while no tab is chosen", () => {
    render(<Screen start="nothing" />);
    expect(underline()).not.toBeVisible();
  });

  it("is placed again when a tab changes size, and stops watching when it goes", () => {
    layTabsOut();
    const watched: Element[] = [];
    let resized = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe(element: Element) {
          watched.push(element);
        }
        disconnect = disconnect;
      },
    );
    const { unmount } = render(<Screen />);
    expect(watched).toHaveLength(3);

    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(120);
    act(() => resized());
    expect(underline().style.transform).toMatch(/scaleX\(1\)$/);

    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("lets a resize that lands as the tabs leave pass by", () => {
    layTabsOut();
    let resized = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe() {}
        // Still delivered after the tabs have gone, as a browser may between React letting go of its refs and this cleanup.
        disconnect() {}
      },
    );
    const { unmount } = render(<Screen />);
    unmount();
    expect(() => resized()).not.toThrow();
  });
});

describe("TabPanel", () => {
  it("is named by its tab, and can be reached to read", () => {
    render(<Screen start="bills" />);
    const panel = screen.getByRole("tabpanel", { name: "Bills" });
    expect(panel).toHaveAttribute("tabindex", "0");
    expect(panel).toHaveAttribute("id", "patient-panel-bills");
  });
});
