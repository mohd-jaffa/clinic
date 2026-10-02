import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { useArrowSelection } from "@/hooks/useArrowSelection";

const VALUES = ["a", "b", "c"] as const;

function Group({ start = "b" }: { start?: string }) {
  const [value, setValue] = useState(start);
  const keys = useArrowSelection(VALUES, value as (typeof VALUES)[number], setValue);
  return (
    <div role="radiogroup" aria-label="Letters" onKeyDown={keys.onKeyDown}>
      {VALUES.map((option) => (
        <button
          key={option}
          ref={keys.register(option)}
          role="radio"
          aria-checked={option === value}
          tabIndex={keys.tabIndex(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

const radio = (name: string) => screen.getByRole("radio", { name });

describe("useArrowSelection", () => {
  it("puts only the chosen option in the Tab order", () => {
    render(<Group />);
    expect(radio("b")).toHaveAttribute("tabindex", "0");
    expect(radio("a")).toHaveAttribute("tabindex", "-1");
  });

  it("lets the first option in when nothing is chosen", () => {
    render(<Group start="none" />);
    expect(radio("a")).toHaveAttribute("tabindex", "0");
  });

  it("moves the choice and the focus with the arrows, wrapping, and to either end", async () => {
    render(<Group />);
    radio("b").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(radio("c")).toBeChecked();
    expect(radio("c")).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(radio("a")).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(radio("c")).toBeChecked();
    await userEvent.keyboard("{ArrowUp}");
    expect(radio("b")).toBeChecked();
    await userEvent.keyboard("{Home}");
    expect(radio("a")).toBeChecked();
    await userEvent.keyboard("{ArrowUp}");
    expect(radio("c")).toBeChecked();
    await userEvent.keyboard("{End}");
    expect(radio("c")).toHaveFocus();
    await userEvent.keyboard("x");
    expect(radio("c")).toBeChecked();
  });

  it("forgets an option that leaves", () => {
    const { unmount } = render(<Group />);
    unmount();
    expect(screen.queryByRole("radio")).toBeNull();
  });
});
