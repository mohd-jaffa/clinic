import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Check, Plus, Trash2 } from "lucide-react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button, IconButton, IconLink, LinkButton } from "@/components/ui/button";

// The router's link, marked, so a plain anchor can be told from it.
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return { default: (props: Record<string, unknown>) => createElement("a", { "data-router": "", ...props }) };
});

const chipOf = (button: HTMLElement) => button.querySelector("[data-chip]");

describe("Button", () => {
  it("shows its label and calls back when pressed", async () => {
    const onClick = vi.fn();
    render(<Button label="Send in" onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: "Send in" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is a plain button unless it is told otherwise, so it never submits a form by accident", () => {
    render(<Button label="Cancel" />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("hands its element to a ref, for a card that puts the focus on it", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref} label="View patient" />);
    expect(ref.current).toBe(screen.getByRole("button", { name: "View patient" }));
  });

  it("submits when it is a form's submit button", () => {
    render(<Button type="submit" label="Save" />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("is the green capsule with its chip trailing, an arrow in it unless told otherwise", () => {
    render(<Button label="Send in" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-action");
    expect(chipOf(button)).toHaveAttribute("data-chip", "trailing");
    expect(chipOf(button)!.querySelector("svg")).not.toBeNull();
  });

  it("moves its chip to the leading edge when the thing is live", () => {
    render(<Button label="With the doctor" icon={Check} live />);
    expect(chipOf(screen.getByRole("button"))).toHaveAttribute("data-chip", "leading");
  });

  it("is the coral capsule for what cannot be undone", () => {
    render(<Button label="Void bill" variant="danger" icon={Trash2} size="sm" />);
    expect(screen.getByRole("button")).toHaveClass("bg-coral");
  });

  it("is an outline or bare words beside a primary, with no chip", () => {
    render(
      <>
        <Button label="Next patient" variant="secondary" />
        <Button label="Cancel" variant="quiet" icon={Plus} size="sm" fullWidth />
      </>,
    );
    const secondary = screen.getByRole("button", { name: "Next patient" });
    expect(secondary).toHaveClass("ring-ink");
    expect(chipOf(secondary)).toBeNull();
    const quiet = screen.getByRole("button", { name: "Cancel" });
    expect(quiet).toHaveClass("text-action", "w-full");
    expect(quiet.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("refuses further presses while it is working, and says it is busy", async () => {
    const onClick = vi.fn();
    render(<Button label="Save" loading onClick={onClick} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(chipOf(button)!.querySelector("svg")).toHaveClass("animate-spin");

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("spins in place of its icon when it has no chip", () => {
    render(<Button label="Retry" variant="secondary" loading />);
    expect(screen.getByRole("button").querySelector("svg")).toHaveClass("animate-spin");
  });

  it("keeps focus while it is busy, so nothing loses its place", () => {
    const { rerender } = render(<Button label="Save" />);
    const button = screen.getByRole("button");
    button.focus();
    rerender(<Button label="Save" loading />);
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
  });

  it("does not submit its form while busy", async () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent)}>
        <Button type="submit" label="Save" loading />
      </form>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps a 44px target whatever its size", () => {
    render(
      <>
        <Button label="Send in" size="sm" />
        <Button label="Later" variant="secondary" size="sm" />
      </>,
    );
    for (const button of screen.getAllByRole("button")) expect(button).toHaveClass("min-h-11");
  });

  it("renders children in place of a label", () => {
    render(<Button>Custom</Button>);
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
  });
});

describe("LinkButton", () => {
  it("stays a link, so it can be opened in a new tab", () => {
    render(<LinkButton href="/patients" label="Add a patient" icon={Plus} />);

    const link = screen.getByRole("link", { name: "Add a patient" });
    expect(link).toHaveAttribute("href", "/patients");
    expect(link).not.toHaveAttribute("target");
  });

  it("dials or opens a chat beside the app, named in full for a screen reader", () => {
    render(
      <>
        <LinkButton href="tel:+919876543210" label="Call" accessibleName="Call Meena" variant="secondary" />
        <LinkButton href="https://wa.me/919876543210" label="WhatsApp" newTab fullWidth size="sm" />
      </>,
    );
    expect(screen.getByRole("link", { name: "Call Meena" })).toHaveAttribute("href", "tel:+919876543210");
    const chat = screen.getByRole("link", { name: "WhatsApp" });
    expect(chat).toHaveAttribute("target", "_blank");
    expect(chat).toHaveAttribute("rel", "noopener noreferrer");
    expect(chat).toHaveClass("w-full");
  });

  it("goes through the router to a place in the app, but opens a file the server answers with as a plain link", () => {
    render(
      <>
        <LinkButton href="/patients" label="Patients" />
        <LinkButton href="/api/visits/v-1/prescription.pdf" label="Print" file newTab />
      </>,
    );
    expect(screen.getByRole("link", { name: "Patients" })).toHaveAttribute("data-router");
    const print = screen.getByRole("link", { name: "Print" });
    expect(print).not.toHaveAttribute("data-router");
    expect(print).toHaveAttribute("href", "/api/visits/v-1/prescription.pdf");
    expect(print).toHaveAttribute("target", "_blank");
  });

  it("tells its screen as it is followed, so a card can close on its way", async () => {
    const onClick = vi.fn();
    render(<LinkButton href="/bills/1" label="View bill" onClick={onClick} />);
    const link = screen.getByRole("link", { name: "View bill" });
    link.addEventListener("click", (event) => event.preventDefault());
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("IconButton", () => {
  it("names itself, because the icon alone says nothing", async () => {
    const onClick = vi.fn();
    render(<IconButton icon={Trash2} label="Remove item 1" onClick={onClick} tone="danger" />);

    await userEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("can be shown with nothing to do, and then does nothing", async () => {
    const onClick = vi.fn();
    render(<IconButton icon={Trash2} label="Previous month" onClick={onClick} tone="outline" disabled />);
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("IconLink", () => {
  it("is a round link out of the app, named by its label, in a new tab, running onClick as it is followed", async () => {
    const onClick = vi.fn();
    render(
      <IconLink
        icon={Trash2}
        label="Remind Rohan Mehta on WhatsApp"
        href="https://wa.me/919876543210"
        onClick={onClick}
      />,
    );
    const link = screen.getByRole("link", { name: "Remind Rohan Mehta on WhatsApp" });
    expect(link).toHaveAttribute("href", "https://wa.me/919876543210");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    link.addEventListener("click", (event) => event.preventDefault());
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalled();
  });
});
