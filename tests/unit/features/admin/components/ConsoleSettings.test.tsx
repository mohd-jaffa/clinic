import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aConsoleSettings } from "@tests/support/console";
import { Providers } from "@tests/support/providers";

const { settings } = vi.hoisted(() => ({
  settings: { current: {} as { data?: unknown; error?: unknown; mutate?: () => void } },
}));
vi.mock("@/features/admin/hooks/useConsoleSettings", () => ({ useConsoleSettings: () => settings.current }));

const { ConsoleSettings } = await import("@/features/admin/components/ConsoleSettings");

const draw = () => render(<ConsoleSettings />, { wrapper: Providers });

beforeEach(() => {
  settings.current = { data: aConsoleSettings() };
});

describe("ConsoleSettings (plan §20.4; D378, D379)", () => {
  it("says who last changed them and when, then each group's settings as they stand", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText(/^Last changed by Jaffa · 30 Oct 2026/)).toBeInTheDocument();
    expect(
      screen.getAllByRole("region").map((region) => within(region).getByRole("heading", { level: 2 }).textContent),
    ).toEqual([
      "Trial and pricing",
      "Expiry",
      "Retention",
      "Invites, follow-ups and imports",
      "Renewal contact",
      "Business details",
    ]);
    const pricing = screen.getByRole("region", { name: "Trial and pricing" });
    expect(pricing).toHaveTextContent("Trial days30 days");
    expect(pricing).toHaveTextContent("Monthly price₹300");
    expect(pricing).toHaveTextContent("Yearly price₹3,000");
    expect(screen.getByRole("region", { name: "Expiry" })).toHaveTextContent("Expiry email days7 and 1 days before");
    expect(screen.getByRole("region", { name: "Invites, follow-ups and imports" })).toHaveTextContent(
      "Rows per import10,000 rows",
    );
    const contact = screen.getByRole("region", { name: "Renewal contact" });
    expect(contact).toHaveTextContent("Renewal mobile+91 98450 12345");
    expect(contact).toHaveTextContent("Renewal emailNot set");
  });

  it("says only when, before anyone has changed them", () => {
    settings.current = { data: aConsoleSettings({ updatedBy: null }) };
    draw();
    expect(screen.getByText(/^Last changed 30 Oct 2026/)).toBeInTheDocument();
  });

  it("opens a group in its own sheet, and closes it again", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Change expiry" }));
    const sheet = screen.getByRole("dialog", { name: "Expiry" });
    expect(within(sheet).getByRole("textbox", { name: /^Grace days/ })).toHaveValue("7");
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Expiry" })).not.toBeInTheDocument();
  });

  it("waits, and says when they could not be loaded, and tries again", async () => {
    settings.current = { data: undefined };
    const { unmount } = draw();
    expect(screen.getByText("The platform’s rules, for every clinic")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Loading…" })).toBeInTheDocument();
    unmount();
    const mutate = vi.fn();
    settings.current = { data: undefined, error: new Error("down"), mutate };
    draw();
    expect(screen.getByText("The platform settings couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalled();
  });
});
