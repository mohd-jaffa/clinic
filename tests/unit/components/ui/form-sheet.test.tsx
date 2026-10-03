import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FormSheet } from "@/components/ui/form-sheet";
import { TextField } from "@/components/ui/text-field";

function open(overrides: Partial<Parameters<typeof FormSheet>[0]> = {}) {
  const props = { open: true, title: "New patient", onClose: vi.fn(), onSubmit: vi.fn(), ...overrides };
  render(
    <FormSheet {...props}>
      <TextField label="Name" />
    </FormSheet>,
  );
  return props;
}

describe("FormSheet", () => {
  it("stays mounted but out of sight while it is closed, so its form keeps what was typed", () => {
    const { container } = render(
      <FormSheet open={false} title="New patient" onClose={vi.fn()} onSubmit={vi.fn()}>
        <TextField label="Name" />
      </FormSheet>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(container.querySelector("input")).toBeInTheDocument();
  });

  it("posts if sent before the page has loaded, so nothing typed lands in the address", () => {
    open();
    const form = screen.getByLabelText("Name").closest("form");
    expect(form).toHaveAttribute("method", "post");
    expect(form).not.toHaveAttribute("action");
  });

  it("is a dialog named by its title, the cursor in its first field", () => {
    open();
    expect(screen.getByRole("dialog", { name: "New patient" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });

  it("closes on Escape and from its close button", async () => {
    const props = open();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("submits from the capsule in its foot — Save unless it says otherwise — and from Enter in a field", async () => {
    const props = open();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.type(screen.getByLabelText("Name"), "Asha{Enter}");
    expect(props.onSubmit).toHaveBeenCalledTimes(2);
  });

  it("takes its own words and a coral capsule for what cannot be undone", () => {
    open({ submitLabel: "Delete clinic", submitVariant: "danger" });
    expect(screen.getByRole("button", { name: "Delete clinic" })).toHaveClass("bg-coral");
  });

  it("says it is saving and refuses a second submit", async () => {
    const props = open({ submitting: true });
    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button);
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});
