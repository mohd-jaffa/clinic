import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SelectMenu } from "@/components/ui/select-menu";

const methods = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

function Menu({
  start = "UPI",
  onChange = vi.fn(),
  ...rest
}: { start?: string; onChange?: (value: string) => void } & Partial<Parameters<typeof SelectMenu>[0]>) {
  const [value, setValue] = useState(start);
  return (
    <SelectMenu
      label="Paid with"
      options={methods}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      {...rest}
    />
  );
}

const control = () => screen.getByRole("combobox", { name: "Paid with" });
const list = () => screen.getByRole("listbox", { name: "Paid with" });
const active = () => document.getElementById(control().getAttribute("aria-activedescendant") ?? "")?.textContent;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SelectMenu", () => {
  it("shows what is chosen, and opens a list of the choices with it marked", async () => {
    render(<Menu />);
    expect(control()).toHaveTextContent("UPI");
    expect(control()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await userEvent.click(control());
    expect(control()).toHaveAttribute("aria-expanded", "true");
    expect(
      within(list())
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Cash", "UPI", "Card", "Other"]);
    expect(within(list()).getByRole("option", { name: "UPI" })).toHaveAttribute("aria-selected", "true");
    expect(active()).toBe("UPI");
  });

  it("takes a tapped choice and closes; the same choice again changes nothing", async () => {
    const onChange = vi.fn();
    render(<Menu onChange={onChange} />);
    await userEvent.click(control());
    await userEvent.hover(within(list()).getByRole("option", { name: "Card" }));
    expect(active()).toBe("Card");
    await userEvent.click(within(list()).getByRole("option", { name: "Card" }));
    expect(onChange).toHaveBeenCalledWith("CARD");
    expect(control()).toHaveTextContent("Card");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    // Focus stays on the control, so the keyboard carries on from it.
    expect(control()).toHaveFocus();

    await userEvent.click(control());
    await userEvent.click(within(list()).getByRole("option", { name: "Card" }));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("closes when its control is tapped again, or anything else is", async () => {
    render(
      <>
        <p>Elsewhere</p>
        <Menu />
      </>,
    );
    await userEvent.click(control());
    await userEvent.click(control());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await userEvent.click(control());
    fireEvent.pointerDown(list());
    expect(list()).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText("Elsewhere"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("moves through the choices with the arrows, Home and End, and takes one with Enter or Space", async () => {
    const onChange = vi.fn();
    render(<Menu onChange={onChange} />);
    control().focus();

    await userEvent.keyboard("{ArrowDown}");
    expect(list()).toBeInTheDocument();
    expect(active()).toBe("UPI");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(active()).toBe("Other");
    await userEvent.keyboard("{ArrowUp}");
    expect(active()).toBe("Card");
    await userEvent.keyboard("{Home}");
    expect(active()).toBe("Cash");
    await userEvent.keyboard("{ArrowUp}");
    expect(active()).toBe("Cash");
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("CASH");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await userEvent.keyboard("{End}");
    expect(active()).toBe("Other");
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith("OTHER");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await userEvent.keyboard("{ArrowUp}");
    expect(active()).toBe("Other");
  });

  it("jumps to the next choice that begins with a letter typed", async () => {
    render(<Menu start="CASH" />);
    control().focus();
    await userEvent.keyboard("c");
    expect(active()).toBe("Card");
    await userEvent.keyboard("c");
    expect(active()).toBe("Cash");
    await userEvent.keyboard("z");
    expect(active()).toBe("Cash");
    await userEvent.keyboard("{Control>}o{/Control}");
    expect(active()).toBe("Cash");
  });

  it("closes on Escape without closing the sheet it sits in, and on Tab", async () => {
    const onSheetKey = vi.fn();
    const onBlur = vi.fn();
    render(
      <div onKeyDown={(event) => onSheetKey(event.key)}>
        <Menu onBlur={onBlur} />
        <button type="button">Next</button>
      </div>,
    );
    await userEvent.click(control());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSheetKey).not.toHaveBeenCalledWith("Escape");

    // Closed, Escape is the sheet's again.
    await userEvent.keyboard("{Escape}");
    expect(onSheetKey).toHaveBeenCalledWith("Escape");

    await userEvent.click(control());
    await userEvent.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onBlur).toHaveBeenCalled();
  });

  it("offers its placeholder as a first choice with the empty value, and reads muted until something is chosen", async () => {
    const onChange = vi.fn();
    render(<Menu start="" placeholder="All methods" onChange={onChange} />);
    expect(control()).toHaveTextContent("All methods");
    await userEvent.click(control());
    expect(within(list()).getByRole("option", { name: "All methods" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(within(list()).getByRole("option", { name: "Cash" }));
    expect(onChange).toHaveBeenCalledWith("CASH");
  });

  it("shows nothing for a value it does not offer, and opens on the first choice", async () => {
    render(<Menu start="SHELLS" />);
    expect(control().querySelector("span")).toHaveTextContent("");
    expect(control().querySelector("span")).toHaveClass("text-muted");
    await userEvent.click(control());
    expect(active()).toBe("Cash");
    expect(within(list()).queryByRole("option", { selected: true })).not.toBeInTheDocument();
  });

  it("is named by a visible label when it has one, and carries the field's state", () => {
    render(
      <>
        <span id="method-label">How it was paid</span>
        <Menu labelledBy="method-label" invalid required describedBy="method-error" disabled />
        <p id="method-error">Choose a method.</p>
      </>,
    );
    const field = screen.getByRole("combobox", { name: "How it was paid" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAttribute("aria-required", "true");
    expect(field).toHaveAccessibleDescription("Choose a method.");
    expect(field).toBeDisabled();
  });

  it("opens under its control where there is room, over it where there is more, and within the screen", async () => {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(400);
    const box = (top: number, left: number) =>
      ({ top, bottom: top + 44, left, right: left + 200, width: 200, height: 44 }) as DOMRect;
    const { rerender } = render(<Menu />);

    vi.spyOn(control(), "getBoundingClientRect").mockReturnValue(box(100, 20));
    await userEvent.click(control());
    expect(list().style.top).toBe("150px");
    expect(list().style.bottom).toBe("auto");
    expect(list().style.minWidth).toBe("200px");
    expect(list().style.maxHeight).toBe("288px");
    expect(list().style.left).toBe("20px");
    await userEvent.click(control());

    // Near the foot of the screen, and on its right: over the control, lined up with its right edge.
    vi.spyOn(control(), "getBoundingClientRect").mockReturnValue(box(700, 190));
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(240);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(240);
    rerender(<Menu />);
    await userEvent.click(control());
    expect(list().style.top).toBe("auto");
    expect(list().style.bottom).toBe("106px");
    expect(list().style.maxHeight).toBe("288px");
    expect(list().style.left).toBe("150px");
  });

  it("goes along with its control when the page scrolls or the screen resizes, but not when the list scrolls", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    render(<Menu />);
    const where = vi.spyOn(control(), "getBoundingClientRect");
    await userEvent.click(control());
    const placed = where.mock.calls.length;

    fireEvent.scroll(list());
    expect(frames).toHaveLength(0);

    fireEvent.scroll(document);
    fireEvent(window, new Event("resize"));
    act(() => frames.forEach((frame) => frame(0)));
    expect(where.mock.calls.length).toBe(placed + 2);
    expect(list()).toBeInTheDocument();

    // Closed, it follows nothing.
    await userEvent.keyboard("{Escape}");
    fireEvent.scroll(document);
    expect(frames).toHaveLength(2);
  });

  it("hands its control to a ref, so a form can focus a refused field", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<SelectMenu ref={ref} label="Paid with" options={methods} value="UPI" onChange={vi.fn()} />);
    expect(ref.current).toBe(control());
  });

  it("keeps the choice the keys are on in view", async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    render(<Menu />);
    control().focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(scrolled).toHaveBeenLastCalledWith({ block: "nearest" });
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  });
});
