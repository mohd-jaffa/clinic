import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Link from "next/link";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Sheet } from "@/components/ui/sheet";

function Screen({ dismissible, role }: { dismissible?: boolean; role?: "dialog" | "alertdialog" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="New patient"
        dismissible={dismissible}
        role={role}
        footer={<button type="button">Save</button>}
      >
        <label>
          Name
          <input />
        </label>
      </Sheet>
    </>
  );
}

const dialog = () => screen.getByRole("dialog", { name: "New patient" });

describe("Sheet", () => {
  it("opens as a modal dialog named by its title, focused on the first field", async () => {
    render(<Screen />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(dialog()).toHaveAttribute("open");
    expect(dialog()).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes on Escape, and gives focus back to what opened it", async () => {
    document.body.style.overflow = "auto";
    render(<Screen />);
    const opener = screen.getByRole("button", { name: "Open" });
    await userEvent.click(opener);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("closes from its close button, and from a tap on the backdrop but not on the panel", async () => {
    render(<Screen />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByLabelText("Name"));
    expect(dialog()).toBeInTheDocument();
    fireEvent.click(dialog());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps what was typed while it is closed", async () => {
    const { container } = render(<Screen />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.type(screen.getByLabelText("Name"), "Priya");
    await userEvent.keyboard("{Escape}");
    expect(container.querySelector("input")).toHaveValue("Priya");
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Priya");
  });

  it("waits for an answer when it is not dismissible", async () => {
    render(<Screen dismissible={false} role="alertdialog" />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const card = screen.getByRole("alertdialog", { name: "New patient" });
    await userEvent.keyboard("{Escape}");
    fireEvent.click(card);
    expect(card).toHaveAttribute("open");
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("focuses what it is told to, or the first control where there is no field", async () => {
    function Card() {
      const primary = useRef<HTMLButtonElement>(null);
      return (
        <Sheet open onClose={vi.fn()} title="Patient added" initialFocus={primary}>
          <button type="button">View bill</button>
          <button ref={primary} type="button">
            Book an appointment
          </button>
        </Sheet>
      );
    }
    const { unmount } = render(<Card />);
    expect(screen.getByRole("button", { name: "Book an appointment" })).toHaveFocus();
    unmount();

    render(
      <Sheet open onClose={vi.fn()} title="Menu">
        <Link href="/patients">Patients</Link>
      </Sheet>,
    );
    expect(screen.getByRole("link", { name: "Patients" })).toHaveFocus();
  });

  it("does not hand focus back to something no longer on the page", async () => {
    function Vanishing() {
      const [open, setOpen] = useState(false);
      return (
        <>
          {!open && (
            <button type="button" onClick={() => setOpen(true)}>
              Open
            </button>
          )}
          <Sheet open={open} onClose={() => setOpen(false)} title="Menu">
            <p>Nothing to focus</p>
          </Sheet>
        </>
      );
    }
    render(<Vanishing />);
    const opener = screen.getByRole("button", { name: "Open" });
    await userEvent.click(opener);
    const focus = vi.spyOn(opener, "focus");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(opener.isConnected).toBe(false);
    expect(focus).not.toHaveBeenCalled();
  });
});

describe("Sheet's Tab loop", () => {
  it("goes round from the last control to the first, and back", async () => {
    render(
      <Sheet open onClose={vi.fn()} title="New patient" footer={<button type="button">Save</button>}>
        <label>
          Name
          <input />
        </label>
        <button type="button" disabled>
          Not now
        </button>
      </Sheet>,
    );
    // jsdom lays nothing out, so every control counts as shown.
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    const close = screen.getByRole("button", { name: "Close" });
    const save = screen.getByRole("button", { name: "Save" });
    save.focus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(save).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByLabelText("Name")).toHaveFocus();
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "a" });
    expect(screen.getByLabelText("Name")).toHaveFocus();
    vi.restoreAllMocks();
  });
});
