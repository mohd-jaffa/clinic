import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { GettingStarted } = await import("@/features/dashboard/components/GettingStarted");

const draw = (steps = { prices: false, team: false }) =>
  render(<GettingStarted steps={steps} />, { wrapper: Providers });
const step = (name: string) => screen.getByText(name).closest("li")!;

beforeEach(() => {
  auth.current = authStub();
});

describe("GettingStarted (plan §17; D348, D352)", () => {
  it("lists the three steps in order, each opening where it is taken", () => {
    draw();
    expect(screen.getByRole("heading", { name: "Getting started" })).toBeInTheDocument();
    expect(screen.getByText("Three steps to set up Smile Care.")).toBeInTheDocument();
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps.map((each) => within(each).getByText(/^(Set|Add)/).textContent)).toEqual([
      "Set your prices",
      "Add your team",
      "Add your first patient",
    ]);
    expect(screen.getByRole("link", { name: "Set your prices" })).toHaveAttribute("href", "/settings/price-list");
    expect(screen.getByRole("link", { name: "Add your team" })).toHaveAttribute("href", "/team");
    expect(screen.getByRole("link", { name: "Add your first patient" })).toHaveAttribute(
      "href",
      "/patients?add=patient",
    );
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
    expect(within(step("Set your prices")).getByText("1")).toBeInTheDocument();
  });

  it("ticks a step once done, its number a check and Done beside it", () => {
    draw({ prices: true, team: true });
    for (const name of ["Set your prices", "Add your team"]) {
      expect(within(step(name)).getByText("Done")).toBeInTheDocument();
      expect(within(step(name)).queryByText(/^\d$/)).not.toBeInTheDocument();
    }
    expect(within(step("Add your first patient")).queryByText("Done")).not.toBeInTheDocument();
    expect(within(step("Add your first patient")).getByText("3")).toBeInTheDocument();
  });

  it("shows a step someone may not take there as words, without a link", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "patients.create"] });
    draw();
    expect(screen.queryByRole("link", { name: "Set your prices" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add your team" })).not.toBeInTheDocument();
    expect(screen.getByText("Add your team")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add your first patient" })).toBeInTheDocument();
  });

  it("links nothing, and names no clinic, before the session is known", () => {
    auth.current = authStub({ status: "loading", profile: null, membership: null });
    draw();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Three steps to set up .")).toBeInTheDocument();
  });
});
