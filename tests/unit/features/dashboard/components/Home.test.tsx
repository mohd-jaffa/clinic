import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";
import { aDashboard } from "@tests/support/dashboard";
import { Providers } from "@tests/support/providers";

const { auth, dashboard } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  dashboard: { current: {} as { data?: unknown; error?: unknown; mutate?: () => void } },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/dashboard/hooks/useDashboard", () => ({ useDashboard: () => dashboard.current }));
vi.mock("@/lib/dates/calendar", async (actual) => ({
  ...(await actual<typeof import("@/lib/dates/calendar")>()),
  clinicHour: () => 9,
  todayKey: () => "2026-10-27",
}));

const { Home } = await import("@/features/dashboard/components/Home");

const draw = () => render(<Home />, { wrapper: Providers });
const figure = (label: RegExp | string) => screen.getByText(label, { selector: "dt, dt *" }).closest("div")!;

beforeEach(() => {
  auth.current = authStub();
  dashboard.current = { data: aDashboard() };
});

describe("Home (plan §17, §32.1; D347 – D353)", () => {
  it("greets the person on the land, today's date and its appointments under it, then waiting and seen", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Good morning, Dr. Asha" })).toBeInTheDocument();
    expect(screen.getByText("Tuesday, 27 Oct 2026 · 14 appointments")).toBeInTheDocument();
    // Waiting for every doctor shown; it opens the queue.
    expect(within(figure("Waiting")).getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Waiting" })).toHaveAttribute("href", "/queue");
    expect(within(figure("Seen")).getByText("6")).toBeInTheDocument();
  });

  it("shows Collected today and Outstanding on the ground, then the sections", () => {
    draw();
    const money = screen.getByRole("region", { name: "Money today" });
    expect(within(money).getByText("₹12,500")).toBeInTheDocument();
    expect(within(money).getByText("₹3,200")).toBeInTheDocument();
    expect(within(money).getByRole("link", { name: "Collected today" })).toHaveAttribute("href", "/reports");
    expect(screen.getByRole("region", { name: /^Today’s queue/ })).toBeInTheDocument();
  });

  it("leaves out what the person's permissions do not open", () => {
    const staff = authStub({ role: "STAFF", permissions: ["patients.view"] });
    auth.current = { ...staff, membership: { ...staff.membership!, doctorId: null } };
    dashboard.current = {
      data: aDashboard({
        day: null,
        money: null,
        queue: null,
        toBill: null,
        followUps: null,
        upcoming: null,
        owing: null,
        payments: null,
        expenses: null,
      }),
    };
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Good morning, Asha" })).toBeInTheDocument();
    expect(screen.getByText("Tuesday, 27 Oct 2026")).toBeInTheDocument();
    expect(screen.queryByText("Waiting")).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("shows seen without waiting, and waiting without seen, as the sections allow", () => {
    dashboard.current = { data: aDashboard({ queue: null }) };
    const { unmount } = draw();
    expect(screen.queryByText("Waiting")).not.toBeInTheDocument();
    expect(screen.getByText("Seen")).toBeInTheDocument();
    unmount();
    dashboard.current = { data: aDashboard({ day: null }) };
    draw();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.queryByText("Seen")).not.toBeInTheDocument();
  });

  it("shows a new clinic its getting-started steps in place of the figures and sections (D348)", () => {
    dashboard.current = { data: aDashboard({ gettingStarted: { prices: false, team: false } }) };
    draw();
    expect(screen.getByRole("region", { name: "Getting started" })).toBeInTheDocument();
    expect(screen.getByText("Three steps to set up Smile Care.")).toBeInTheDocument();
    expect(screen.getByText("Tuesday, 27 Oct 2026")).toBeInTheDocument();
    expect(screen.queryByText("Waiting")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Money today" })).not.toBeInTheDocument();
  });

  it("draws its land before the session and the figures are known, the ground waiting", () => {
    auth.current = authStub({ status: "loading", profile: null, membership: null });
    dashboard.current = { data: undefined };
    draw();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Good morning,");
    expect(screen.getByText("Tuesday, 27 Oct 2026")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Loading…" })).toHaveAttribute("aria-busy", "true");
  });

  it("says when the figures could not be loaded, and tries again", async () => {
    const mutate = vi.fn();
    dashboard.current = { data: undefined, error: new Error("down"), mutate };
    draw();
    expect(screen.getByText("Today's figures couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalled();
  });
});
