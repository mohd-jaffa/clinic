import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { History } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { Disclosure } from "@/components/ui/disclosure";

describe("Disclosure", () => {
  it("keeps what it holds out of the way until asked, and puts it away again", async () => {
    render(
      <Disclosure label="Past" showLabel="Show past (2)" hideLabel="Hide past" icon={History} className="mt-8">
        <p>Onam leave</p>
      </Disclosure>,
    );
    const section = screen.getByRole("region", { name: "Past" });
    expect(section).toHaveClass("mt-8");
    const toggle = screen.getByRole("button", { name: "Show past (2)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Onam leave")).not.toBeVisible();

    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide past" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Onam leave")).toBeVisible();
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).toContainElement(
      screen.getByText("Onam leave"),
    );

    await userEvent.click(screen.getByRole("button", { name: "Hide past" }));
    expect(screen.queryByText("Onam leave")).not.toBeVisible();
  });

  it("is held by its owner when handed `shown`: opened from outside, and asking to change", async () => {
    const onShownChange = vi.fn();
    const { rerender } = render(
      <Disclosure
        label="More"
        showLabel="More details"
        hideLabel="Fewer details"
        icon={History}
        shown={false}
        onShownChange={onShownChange}
      >
        <p>Email</p>
      </Disclosure>,
    );
    await userEvent.click(screen.getByRole("button", { name: "More details" }));
    expect(onShownChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText("Email")).not.toBeVisible();
    rerender(
      <Disclosure
        label="More"
        showLabel="More details"
        hideLabel="Fewer details"
        icon={History}
        shown
        onShownChange={onShownChange}
      >
        <p>Email</p>
      </Disclosure>,
    );
    expect(screen.getByText("Email")).toBeVisible();
  });
});
