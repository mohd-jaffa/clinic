import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { placeAgainst, useAnchoredPopover } from "@/components/ui/anchored-popover";

function Anchored({ onDismiss = vi.fn(), maxHeight = 300 }: { onDismiss?: () => void; maxHeight?: number }) {
  const [open, setOpen] = useState(false);
  const control = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useAnchoredPopover({
    open,
    panel,
    control,
    maxHeight,
    onDismiss: () => {
      setOpen(false);
      onDismiss();
    },
  });
  return (
    <>
      <button ref={control} type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        Open
      </button>
      <div ref={panel} role="dialog" aria-label="Panel" popover="manual">
        <button type="button">Inside</button>
      </div>
      <p>Outside</p>
    </>
  );
}

const box = (top: number, height: number, left = 20, width = 200) =>
  ({
    top,
    bottom: top + height,
    left,
    right: left + width,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

const control = () => screen.getByRole("button", { name: "Open" });
const panel = () => screen.getByRole("dialog", { name: "Panel" });

afterEach(() => vi.restoreAllMocks());

describe("placeAgainst", () => {
  it("opens under the control where there is room, as wide as it at least, from its edge", () => {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(400);
    const element = document.createElement("div");
    const anchor = document.createElement("button");
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue(box(100, 44));
    placeAgainst(element, anchor, 300);
    expect(element.style).toMatchObject({
      top: "150px",
      bottom: "auto",
      minWidth: "200px",
      maxHeight: "300px",
      left: "20px",
    });
  });

  it("opens over the control where there is more room, lined up with its nearer edge, inside the screen", () => {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(400);
    const element = document.createElement("div");
    vi.spyOn(element, "scrollHeight", "get").mockReturnValue(360);
    vi.spyOn(element, "offsetWidth", "get").mockReturnValue(320);
    const anchor = document.createElement("button");
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue(box(700, 44, 300, 90));
    placeAgainst(element, anchor, 440);
    expect(element.style).toMatchObject({ top: "auto", bottom: "106px", maxHeight: "440px" });
    // Its right edge would be at the control's, 390 px; 320 px wide, that is 70 px from the left.
    expect(element.style.left).toBe("70px");
  });
});

describe("useAnchoredPopover", () => {
  it("shows the panel in the top layer as it opens, and hides it as it closes", () => {
    render(<Anchored />);
    expect(screen.queryByRole("dialog", { name: "Panel" })).not.toBeInTheDocument();
    fireEvent.click(control());
    expect(panel()).toBeVisible();
    fireEvent.click(control());
    expect(screen.queryByRole("dialog", { name: "Panel" })).not.toBeInTheDocument();
  });

  it("is dismissed by a tap elsewhere, not by one inside it or on its control", () => {
    const onDismiss = vi.fn();
    render(<Anchored onDismiss={onDismiss} />);
    fireEvent.click(control());
    fireEvent.pointerDown(screen.getByRole("button", { name: "Inside" }));
    fireEvent.pointerDown(control());
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText("Outside"));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(control()).toHaveAttribute("aria-expanded", "false");
  });

  it("moves with its control on a scroll or a resize, once a frame, and not for a scroll inside it", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    render(<Anchored />);
    fireEvent.click(control());
    const where = vi.spyOn(control(), "getBoundingClientRect");

    fireEvent.scroll(panel());
    expect(frames).toHaveLength(0);
    fireEvent.scroll(document);
    fireEvent(window, new Event("resize"));
    expect(frames).toHaveLength(2);
    expect(cancel).toHaveBeenCalled();
    act(() => frames.at(-1)!(0));
    expect(where).toHaveBeenCalled();
  });

  it("stops listening once closed", () => {
    const onDismiss = vi.fn();
    render(<Anchored onDismiss={onDismiss} />);
    fireEvent.click(control());
    fireEvent.click(control());
    fireEvent.pointerDown(screen.getByText("Outside"));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
