import { cleanup, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SubscriptionState } from "@/constants/statuses";
import { aSession, authStub } from "@tests/support/auth";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { PlanBanner } = await import("@/components/nav/PlanBanner");

const { subscription } = aSession();

/** A clinic whose plan ends, or ended, on 12 Nov and is view-only from 20 Nov. */
function inState(state: SubscriptionState, role: "OWNER" | "STAFF" = "OWNER") {
  auth.current = authStub({
    role,
    subscription: { ...subscription!, validUntil: "2026-11-12", readOnlyFrom: "2026-11-20", state },
  });
  render(<PlanBanner />);
  return screen.queryByRole("region", { name: "Your plan" });
}

beforeEach(() => {
  auth.current = authStub();
});

describe("PlanBanner (plan §7.2, D73)", () => {
  it("is not there while the plan is active", () => {
    expect(inState("ACTIVE")).toBeNull();
  });

  it("tells the owner when their plan ends, quietly, with How to renew leading to the Plan screen", () => {
    const banner = inState("EXPIRING")!;
    expect(banner).toHaveTextContent("Your plan ends on 12 Nov.");
    // One after the words on a phone, one beside them from 640 px; the screen's width shows one.
    const renew = within(banner).getAllByRole("link", { name: "How to renew" });
    expect(renew.map((link) => link.getAttribute("href"))).toEqual(["/settings/plan", "/settings/plan"]);
    expect(renew[0]).toHaveClass("sm:hidden");
    expect(renew[1]).toHaveClass("hidden", "sm:inline-flex");
    expect(banner).toHaveClass("bg-surface");
  });

  it("tells everyone else of the clinic's plan, with nothing for them to do", () => {
    const banner = inState("EXPIRING", "STAFF")!;
    expect(banner).toHaveTextContent("The clinic’s plan ends on 12 Nov.");
    expect(within(banner).queryByRole("link")).not.toBeInTheDocument();
  });

  it("in grace, says when it ended and when the clinic becomes view-only, in coral", () => {
    const banner = inState("GRACE")!;
    expect(banner).toHaveTextContent("Your plan ended on 12 Nov. The clinic becomes view-only on 20 Nov.");
    expect(banner).toHaveClass("bg-coral-soft");
  });

  it("in grace, tells a member the same of the clinic", () => {
    expect(inState("GRACE", "STAFF")).toHaveTextContent(
      "The clinic’s plan ended on 12 Nov. It becomes view-only on 20 Nov.",
    );
  });

  it("once view-only, says so with no date — a clinic with no trial ended before it began", () => {
    const banner = inState("READ_ONLY")!;
    expect(banner).toHaveTextContent("Your clinic is view-only. Renew its plan to make changes.");
    expect(within(banner).getAllByRole("link", { name: "How to renew" })).toHaveLength(2);
    cleanup();
    expect(inState("READ_ONLY", "STAFF")).toHaveTextContent("The clinic is view-only until its owner renews its plan.");
  });

  it("is not there for someone with no clinic", () => {
    auth.current = authStub({ membership: null });
    render(<PlanBanner />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
