import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Resolver } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { useVisitSection } from "@/features/visits/hooks/useVisitSection";

type Saved = { text: string | null };
type Input = { text: string };

/** Whatever is typed passes: the hook's work is the copies, not the checks. */
const pass: Resolver<Input> = async (values) => ({ values, errors: {} });

/** A section with one field, showing what the hook holds. */
function Section({ saved }: { saved: Saved }) {
  const section = useVisitSection<Saved, Input>({
    saved,
    toInput: (copy) => ({ text: copy.text ?? "" }),
    resolver: pass,
  });
  return (
    <>
      <input aria-label="Text" {...section.form.register("text")} />
      <output aria-label="Seen">{JSON.stringify(section.seen)}</output>
      <output aria-label="Theirs">{section.theirs === undefined ? "none" : JSON.stringify(section.theirs)}</output>
      <output aria-label="Typed">{String(section.dirty)}</output>
      <button type="button" onClick={section.takeTheirs}>
        Take theirs
      </button>
      <button type="button" onClick={() => section.saved({ text: "Mine" })}>
        Saved
      </button>
    </>
  );
}

const field = () => screen.getByRole("textbox", { name: "Text" });
const shown = (name: string) => screen.getByRole("status", { name }).textContent;

describe("useVisitSection (D202, D206)", () => {
  it("follows a newer copy while untouched, and makes its saves from it", async () => {
    const { rerender } = render(<Section saved={{ text: null }} />);
    expect(field()).toHaveValue("");
    expect(shown("Seen")).toBe('{"text":null}');

    rerender(<Section saved={{ text: "Fever" }} />);
    expect(await screen.findByDisplayValue("Fever")).toBe(field());
    expect(shown("Seen")).toBe('{"text":"Fever"}');
    expect(shown("Theirs")).toBe("none");
    expect(shown("Typed")).toBe("false");
  });

  it("keeps what is typed when a newer copy arrives, holding theirs beside it — and saves from theirs", async () => {
    const { rerender } = render(<Section saved={{ text: "Fever" }} />);
    await userEvent.type(field(), ", cough");
    expect(shown("Typed")).toBe("true");

    // The same words read again are no one else's.
    rerender(<Section saved={{ text: "Fever" }} />);
    expect(shown("Theirs")).toBe("none");
    expect(shown("Seen")).toBe('{"text":"Fever"}');

    rerender(<Section saved={{ text: "Fever, 3 days" }} />);
    expect(field()).toHaveValue("Fever, cough");
    expect(shown("Theirs")).toBe('{"text":"Fever, 3 days"}');
    expect(shown("Seen")).toBe('{"text":"Fever, 3 days"}');

    await userEvent.click(screen.getByRole("button", { name: "Take theirs" }));
    expect(field()).toHaveValue("Fever, 3 days");
    expect(shown("Theirs")).toBe("none");
    expect(shown("Typed")).toBe("false");
  });

  it("starts again from the copy just saved, and takes the copy from before the save, still read, for no news", async () => {
    const { rerender } = render(<Section saved={{ text: "Fever" }} />);
    await userEvent.type(field(), "!");
    await userEvent.click(screen.getByRole("button", { name: "Saved" }));
    expect(field()).toHaveValue("Mine");
    expect(shown("Seen")).toBe('{"text":"Mine"}');
    expect(shown("Typed")).toBe("false");

    // The screen still holds the copy from before the save: not followed, not theirs.
    rerender(<Section saved={{ text: "Fever" }} />);
    expect(field()).toHaveValue("Mine");
    expect(shown("Seen")).toBe('{"text":"Mine"}');
    await userEvent.type(field(), "?");
    expect(shown("Theirs")).toBe("none");
  });

  it("once the saved copy is read back, a copy other than it is news again", async () => {
    const { rerender } = render(<Section saved={{ text: "Fever" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Saved" }));
    rerender(<Section saved={{ text: "Mine" }} />);
    expect(shown("Theirs")).toBe("none");
    expect(field()).toHaveValue("Mine");

    // The copy from before the save, read again now, is someone's change: followed while untouched.
    rerender(<Section saved={{ text: "Fever" }} />);
    expect(await screen.findByDisplayValue("Fever")).toBe(field());
    expect(shown("Seen")).toBe('{"text":"Fever"}');
  });

  it("after a save, holds a later copy as theirs while typed into", async () => {
    const { rerender } = render(<Section saved={{ text: "Fever" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Saved" }));
    await userEvent.type(field(), " and more");
    rerender(<Section saved={{ text: "Cough" }} />);
    expect(field()).toHaveValue("Mine and more");
    expect(shown("Theirs")).toBe('{"text":"Cough"}');
    expect(shown("Seen")).toBe('{"text":"Cough"}');
  });
});
