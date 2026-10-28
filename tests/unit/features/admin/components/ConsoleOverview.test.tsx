import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aConsoleOverview } from "@tests/support/console";
import { Providers } from "@tests/support/providers";

const { overview } = vi.hoisted(() => ({
  overview: { current: {} as { data?: unknown; error?: unknown; mutate?: () => void } },
}));
vi.mock("@/features/admin/hooks/useConsoleOverview", () => ({ useConsoleOverview: () => overview.current }));

const { ConsoleOverview } = await import("@/features/admin/components/ConsoleOverview");

const draw = () => render(<ConsoleOverview />, { wrapper: Providers });

beforeEach(() => {
  overview.current = { data: aConsoleOverview() };
});

describe("ConsoleOverview (plan §20.1; D368)", () => {
  it("says the platform's today and how many clinics, with those waiting for activation, on the land", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("Wednesday, 28 Oct 2026 · 5 clinics")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clinics" })).toHaveAttribute("href", "/admin/clinics");
    expect(screen.getByRole("link", { name: "Waiting for activation" })).toHaveAttribute(
      "href",
      "/admin/clinics?filter=NO_TRIAL",
    );
  });

  it("counts each clinic once by state, each opening the list kept to it, then the week and the month", () => {
    draw();
    const standings = screen.getByRole("region", { name: "Clinics by state" });
    expect(
      within(standings)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Trial", "Active", "Ending soon", "Ended", "View only"]);
    expect(within(standings).getByRole("link", { name: "Ending soon" })).toHaveAttribute(
      "href",
      "/admin/clinics?filter=EXPIRING",
    );
    const lately = screen.getByRole("region", { name: "This week and month" });
    expect(lately).toHaveTextContent("Sign-ups this week1Sign-ups this month4Extensions this month2");
  });

  it("names one clinic so", () => {
    overview.current = { data: aConsoleOverview({ clinics: 1 }) };
    draw();
    expect(screen.getByText("Wednesday, 28 Oct 2026 · 1 clinic")).toBeInTheDocument();
  });

  it("waits, and says when it could not be loaded, and tries again", async () => {
    overview.current = { data: undefined };
    const { unmount } = draw();
    expect(screen.getByRole("region", { name: "Loading…" })).toHaveAttribute("aria-busy", "true");
    unmount();
    const mutate = vi.fn();
    overview.current = { data: undefined, error: new Error("down"), mutate };
    draw();
    expect(screen.getByText("The overview couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalled();
  });
});
