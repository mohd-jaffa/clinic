import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";
import { aPlan } from "@tests/support/plan";
import { Providers } from "@tests/support/providers";

const { auth, plan } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  plan: { current: {} as { data?: unknown; error?: unknown; mutate?: () => void } },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/subscription/hooks/usePlan", () => ({ usePlan: () => plan.current }));

const { PlanScreen } = await import("@/features/subscription/components/PlanScreen");

const draw = () => render(<PlanScreen />, { wrapper: Providers });
/** The land's one figure: the last day, read with what it is. */
const lastDay = () => screen.getByText("Valid until", { exact: false, selector: "dt" }).closest("div")!;

beforeEach(() => {
  auth.current = authStub();
  plan.current = { data: aPlan() };
});

describe("PlanScreen (plan §7.5; D363 – D366)", () => {
  it("names the plan on the land, with its last day in display numerals and Active under it", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Monthly plan" })).toBeInTheDocument();
    expect(screen.getByText("Smile Care")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/settings");
    expect(within(lastDay()).getByText("Valid until · Active")).toBeInTheDocument();
    expect(within(lastDay()).getByText("12 Nov 2026")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "How to renew" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "History" })).toBeInTheDocument();
  });

  it("says how near the end is while it ends soon (D363)", () => {
    for (const [today, words] of [
      ["2026-11-12", "Ends today"],
      ["2026-11-11", "Ends tomorrow"],
      ["2026-11-07", "Ends in 5 days"],
    ]) {
      plan.current = { data: aPlan({ state: "EXPIRING", today }) };
      const { unmount } = draw();
      expect(within(lastDay()).getByText("Valid until")).toBeInTheDocument();
      expect(within(lastDay()).getByText(words)).toBeInTheDocument();
      unmount();
    }
  });

  it("says when the clinic becomes view-only once it has ended, and that it is", () => {
    plan.current = { data: aPlan({ state: "GRACE", today: "2026-11-14" }) };
    const { unmount } = draw();
    expect(within(lastDay()).getByText("Ended · view-only from 20 Nov")).toBeInTheDocument();
    unmount();
    plan.current = { data: aPlan({ state: "READ_ONLY", today: "2026-11-25" }) };
    draw();
    expect(within(lastDay()).getByText("View-only")).toBeInTheDocument();
  });

  it("names a Yearly plan, and the free trial as itself", () => {
    plan.current = { data: aPlan({ plan: "YEARLY" }) };
    const { unmount } = draw();
    expect(screen.getByRole("heading", { level: 1, name: "Yearly plan" })).toBeInTheDocument();
    unmount();
    plan.current = { data: aPlan({ plan: "TRIAL", payments: [] }) };
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Free trial" })).toBeInTheDocument();
  });

  it("draws its land before the plan is known, the ground waiting", () => {
    plan.current = { data: undefined };
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Plan" })).toBeInTheDocument();
    expect(screen.queryByText("Valid until", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Loading…" })).toHaveAttribute("aria-busy", "true");
  });

  it("says when the plan could not be loaded, and tries again", async () => {
    const mutate = vi.fn();
    plan.current = { data: undefined, error: new Error("down"), mutate };
    draw();
    expect(screen.getByText("Your plan couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalled();
  });

  it("names no clinic before the session is known", () => {
    auth.current = authStub({ membership: null });
    draw();
    expect(screen.queryByText("Smile Care")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^WhatsApp/ })).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent("renew the plan for .")),
    );
  });
});
