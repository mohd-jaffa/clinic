import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SuggestField, type Suggestion } from "@/components/ui/suggest-field";

const MEDICINES: Suggestion[] = [
  { key: "p500", label: "Paracetamol 500 mg", detail: "1 tab · 1-0-1" },
  { key: "p650", label: "Paracetamol 650 mg", detail: "1 tab · SOS" },
  { key: "pan", label: "Pantoprazole 40 mg" },
];

/** The field as a screen holds it: what is typed, and the suggestions for it. */
function Field({
  suggestions = MEDICINES,
  onPick = vi.fn(),
  ...rest
}: { suggestions?: Suggestion[]; onPick?: (key: string) => void } & Partial<Parameters<typeof SuggestField>[0]>) {
  const [value, setValue] = useState("");
  return (
    <SuggestField
      label="Medicine"
      listLabel="Medicines written before"
      suggestions={suggestions}
      onPick={onPick}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      {...rest}
    />
  );
}

const field = () => screen.getByRole("combobox", { name: /^Medicine/ });
const list = () => screen.getByRole("listbox", { name: "Medicines written before" });
const active = () => document.getElementById(field().getAttribute("aria-activedescendant") ?? "")?.textContent;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SuggestField (D211)", () => {
  it("is a text field with a list, closed until something is typed", async () => {
    render(<Field />);
    expect(field()).toHaveAttribute("aria-autocomplete", "list");
    expect(field()).toHaveAttribute("autocomplete", "off");
    expect(field()).toHaveAttribute("aria-expanded", "false");
    expect(field()).not.toHaveAttribute("aria-activedescendant");
    expect(field()).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await userEvent.type(field(), "pa");
    expect(field()).toHaveValue("pa");
    expect(field()).toHaveAttribute("aria-expanded", "true");
    expect(field()).toHaveAttribute("aria-controls", list().id);
    expect(
      within(list())
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Paracetamol 500 mg1 tab · 1-0-1", "Paracetamol 650 mg1 tab · SOS", "Pantoprazole 40 mg"]);
    // Typing moves no suggestion under the keys.
    expect(field()).not.toHaveAttribute("aria-activedescendant");
  });

  it("opens only once there are suggestions to show", async () => {
    const { rerender } = render(<Field suggestions={[]} />);
    await userEvent.type(field(), "zz");
    expect(field()).toHaveAttribute("aria-expanded", "false");
    // Down with nothing to show does nothing.
    await userEvent.keyboard("{ArrowDown}");
    expect(field()).toHaveAttribute("aria-expanded", "false");

    rerender(<Field suggestions={MEDICINES} />);
    expect(field()).toHaveAttribute("aria-expanded", "true");
  });

  it("moves through the suggestions with Down and Up, and takes one with Enter", async () => {
    const onPick = vi.fn();
    const onKeyDown = vi.fn();
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    render(<Field onPick={onPick} onKeyDown={onKeyDown} />);
    await userEvent.type(field(), "p");

    // Enter with none under the keys takes nothing.
    await userEvent.keyboard("{Enter}");
    expect(onPick).not.toHaveBeenCalled();

    await userEvent.keyboard("{ArrowDown}");
    expect(active()).toBe("Paracetamol 500 mg1 tab · 1-0-1");
    expect(within(list()).getByRole("option", { name: /Paracetamol 500 mg/ })).toHaveAttribute("aria-selected", "true");
    expect(scrolled).toHaveBeenCalledWith({ block: "nearest" });
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(active()).toBe("Pantoprazole 40 mg");
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(active()).toBe("Paracetamol 500 mg1 tab · 1-0-1");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenCalledWith("p650");
    expect(field()).toHaveAttribute("aria-expanded", "false");
    expect(onKeyDown).toHaveBeenCalled();
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it("opens again with Down on the first suggestion, and Up does nothing while closed", async () => {
    render(<Field />);
    await userEvent.type(field(), "p");
    await userEvent.keyboard("{Escape}");
    expect(field()).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{ArrowUp}");
    expect(field()).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{ArrowDown}");
    expect(field()).toHaveAttribute("aria-expanded", "true");
    expect(active()).toBe("Paracetamol 500 mg1 tab · 1-0-1");
  });

  it("closes with Escape without closing the sheet it sits in; closed, Escape is the sheet's", async () => {
    const sheet = vi.fn();
    render(
      <div onKeyDown={(event) => event.key === "Escape" && sheet()}>
        <Field />
      </div>,
    );
    await userEvent.type(field(), "p");
    await userEvent.keyboard("{Escape}");
    expect(field()).toHaveAttribute("aria-expanded", "false");
    expect(sheet).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(sheet).toHaveBeenCalledOnce();
  });

  it("takes a tapped suggestion, keeping the focus in the field; the pointer moves the one under the keys", async () => {
    const onPick = vi.fn();
    render(<Field onPick={onPick} />);
    await userEvent.type(field(), "p");
    await userEvent.hover(within(list()).getByRole("option", { name: /Pantoprazole/ }));
    expect(active()).toBe("Pantoprazole 40 mg");
    await userEvent.click(within(list()).getByRole("option", { name: /Paracetamol 650 mg/ }));
    expect(onPick).toHaveBeenCalledWith("p650");
    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when the field is left, or anything else is tapped", async () => {
    const onBlur = vi.fn();
    render(
      <>
        <Field onBlur={onBlur} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await userEvent.type(field(), "p");
    await userEvent.tab();
    expect(field()).toHaveAttribute("aria-expanded", "false");
    expect(onBlur).toHaveBeenCalledOnce();

    await userEvent.type(field(), "a");
    expect(field()).toHaveAttribute("aria-expanded", "true");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Elsewhere" }));
    expect(field()).toHaveAttribute("aria-expanded", "false");
  });

  it("takes the last suggestion should the list shrink under the keys", async () => {
    const onPick = vi.fn();
    const { rerender } = render(<Field onPick={onPick} />);
    await userEvent.type(field(), "p");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    rerender(<Field onPick={onPick} suggestions={MEDICINES.slice(0, 1)} />);
    // The keys were past the end: they rest on the last there is, and it is named.
    expect(active()).toContain("Paracetamol 500 mg");
    await userEvent.keyboard("{Enter}");
    expect(onPick).toHaveBeenCalledWith("p500");
  });

  it("works with neither a change nor a blur of the screen's own", async () => {
    render(
      <SuggestField label="Medicine" listLabel="Medicines written before" suggestions={MEDICINES} onPick={vi.fn()} />,
    );
    await userEvent.type(field(), "p");
    expect(field()).toHaveAttribute("aria-expanded", "true");
    await userEvent.tab();
    expect(field()).toHaveAttribute("aria-expanded", "false");
  });

  it("is labelled and described as a field: required, its hint, its error and a warning beside it", () => {
    const ref = createRef<HTMLInputElement>();
    const { rerender } = render(
      <>
        <Field ref={ref} required hint="As written on the strip" describedBy="warning" />
        <p id="warning">Allergy: Penicillin</p>
      </>,
    );
    expect(ref.current).toBe(field());
    expect(field()).toBeRequired();
    expect(field()).toHaveAccessibleDescription("As written on the strip Allergy: Penicillin");
    expect(field()).not.toHaveAttribute("aria-invalid");

    rerender(
      <>
        <Field ref={ref} optional error="Medicine needs a value." />
        <p id="warning">Allergy: Penicillin</p>
      </>,
    );
    expect(screen.getByText("(Optional)")).toBeInTheDocument();
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field()).toHaveAccessibleDescription("Medicine needs a value.");
    expect(screen.getByRole("alert")).toHaveTextContent("Medicine needs a value.");
  });
});
