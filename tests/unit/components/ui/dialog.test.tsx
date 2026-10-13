import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui/dialog";

describe("Dialog", () => {
  it("is a card named by its title, saying why, its actions at the end", () => {
    render(
      <Dialog open title="Cancel this appointment?" actions={<button type="button">Cancel appointment</button>}>
        Rohan Mehta, 10:15 AM with Dr Meera Nair.
      </Dialog>,
    );
    const card = screen.getByRole("dialog", { name: "Cancel this appointment?" });
    expect(card).toHaveClass("modal-card");
    expect(card).toHaveTextContent("Rohan Mehta, 10:15 AM with Dr Meera Nair.");
    expect(screen.getByRole("button", { name: "Cancel appointment" })).toHaveFocus();
  });

  it("closes on Escape when it may be dismissed", async () => {
    const onDismiss = vi.fn();
    render(<Dialog open title="Saved" onDismiss={onDismiss} actions={<button type="button">Done</button>} />);
    await userEvent.keyboard("{Escape}");
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("must be answered when it is an alert with no way to dismiss it, focused where it is told", () => {
    function Ask() {
      const keep = useRef<HTMLButtonElement>(null);
      return (
        <Dialog
          open
          role="alertdialog"
          title="Sign out?"
          initialFocus={keep}
          actions={
            <>
              <button type="button" ref={keep}>
                Stay
              </button>
              <button type="button">Sign out</button>
            </>
          }
        />
      );
    }
    render(<Ask />);
    expect(screen.getByRole("alertdialog", { name: "Sign out?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stay" })).toHaveFocus();
  });

  it("shows its mark above its title, and a close button when it only tells", async () => {
    const onDismiss = vi.fn();
    render(
      <Dialog open title="Patient saved" onDismiss={onDismiss} mark={<span>Saved mark</span>} closable>
        Meena Gupta is in your patients.
      </Dialog>,
    );
    const card = screen.getByRole("dialog", { name: "Patient saved" });
    expect(card).toHaveTextContent(/^Saved markPatient saved/);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("has no close button where nothing may dismiss it", () => {
    render(<Dialog open role="alertdialog" title="Plan ends in 3 days" closable actions={<button>See plan</button>} />);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("puts its actions in a row that wraps from a tablet up, or one under another at every width when told", () => {
    const { rerender } = render(<Dialog open title="Sign out?" actions={<button type="button">Sign out</button>} />);
    const row = screen.getByRole("button", { name: "Sign out" }).parentElement!;
    expect(row).toHaveClass("flex-col-reverse", "sm:flex-row", "sm:flex-wrap");
    rerender(<Dialog open title="Sign out?" stackActions actions={<button type="button">Sign out</button>} />);
    expect(screen.getByRole("button", { name: "Sign out" }).parentElement).not.toHaveClass("sm:flex-row");
  });
});
