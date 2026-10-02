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
});
