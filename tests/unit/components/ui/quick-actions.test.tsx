import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarPlus, Footprints, UserPlus } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { QuickActions, type QuickAction } from "@/components/ui/quick-actions";

function Bar({ actions }: { actions: QuickAction[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Quick add
      </button>
      <QuickActions open={open} onClose={() => setOpen(false)} actions={actions} />
    </>
  );
}

describe("QuickActions", () => {
  it("rises as a lobe named Add, focused on its first action, each a capsule with its mark", async () => {
    const walkIn = vi.fn();
    render(
      <Bar
        actions={[
          { key: "walk-in", label: "Walk-in", icon: Footprints, onClick: walkIn },
          { key: "appointment", label: "Appointment", icon: CalendarPlus, href: "/appointments" },
          { key: "patient", label: "Patient", icon: UserPlus, href: "/patients" },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Quick add" }));

    const lobe = screen.getByRole("dialog", { name: "Add" });
    expect(lobe).toHaveClass("modal-lobe");
    expect(screen.getByRole("button", { name: "Walk-in" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "Appointment" })).toHaveAttribute("href", "/appointments");
    // The odd one out takes the whole last row.
    expect(screen.getByRole("link", { name: "Patient" }).parentElement).toHaveClass("last:odd:col-span-2");

    await userEvent.click(screen.getByRole("button", { name: "Walk-in" }));
    expect(walkIn).toHaveBeenCalledOnce();
    expect(lobe).not.toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Quick add" })).toHaveFocus();
  });

  it("sinks back from its close button and when a place is chosen", async () => {
    render(<Bar actions={[{ key: "patient", label: "Patient", icon: UserPlus, href: "/patients" }]} />);
    const open = () => userEvent.click(screen.getByRole("button", { name: "Quick add" }));

    await open();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Add" })).not.toBeInTheDocument();

    await open();
    await userEvent.click(screen.getByRole("link", { name: "Patient" }));
    expect(screen.queryByRole("dialog", { name: "Add" })).not.toBeInTheDocument();
  });
});
