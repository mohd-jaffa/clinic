import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { settleNavigation, SLOW_MS, startNavigation } from "@/lib/navigation/pending";
import { aDeveloperSession, authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, place } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  place: { pathname: "/admin" },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => place.pathname,
}));

const { ConsoleShell } = await import("@/components/nav/ConsoleShell");

beforeEach(() => {
  const { profile } = aDeveloperSession();
  auth.current = authStub({ profile, membership: null, subscription: null });
  place.pathname = "/admin";
});

function shell() {
  render(
    <Providers>
      <ConsoleShell>
        <h1>Overview</h1>
      </ConsoleShell>
    </Providers>,
  );
  const [side, bar] = screen.getAllByRole("navigation", { name: "Main" });
  return { side, bar };
}

const names = (scope: HTMLElement) =>
  within(scope)
    .queryAllByRole("link")
    .map((link) => link.textContent);

describe("the console's frame (D367)", () => {
  it("heads the sidebar Console, with every place in two groups and the account at its foot", () => {
    const { side } = shell();
    expect(within(screen.getByRole("main")).getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("Console")).toBeInTheDocument();
    expect(names(side)).toEqual(["Overview", "Clinics", "Accounts", "Settings", "Error log", "Audit"]);
    expect(within(side).getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/admin/settings");
    expect(screen.getByRole("button", { name: /^Account: / })).toHaveTextContent("Developer");
  });

  it("holds Overview, Clinics and Accounts in the phone's bar, then More — and nothing to add", () => {
    const { bar } = shell();
    expect(names(bar)).toEqual(["Overview", "Clinics", "Accounts"]);
    expect(within(bar).getByRole("button", { name: "More" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
  });

  it("marks the Overview only at its own address, and any other place within it", () => {
    const { side, bar } = shell();
    expect(within(side).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(within(bar).getByRole("button", { name: "More" })).not.toHaveAttribute("aria-current");
  });

  it("marks Clinics on a clinic's page, and More on a place it holds", () => {
    place.pathname = "/admin/clinics/c-1";
    const { side, unmount } = { ...shell(), unmount: () => document.body.replaceChildren() };
    expect(within(side).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(within(side).getByRole("link", { name: "Clinics" })).toHaveAttribute("aria-current", "page");
    unmount();

    place.pathname = "/admin/logs";
    const { bar } = shell();
    expect(within(bar).getByRole("button", { name: "More" })).toHaveAttribute("aria-current", "true");
  });

  it("opens More on Settings, the Error log, the Audit and Sign out, and closes as a place is followed", async () => {
    const { bar } = shell();
    await userEvent.click(within(bar).getByRole("button", { name: "More" }));
    const sheet = screen.getByRole("dialog", { name: "More" });
    expect(within(sheet).getByText("Developer")).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: /^Error log/ })).toHaveAttribute("href", "/admin/logs");
    expect(within(sheet).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    const audit = within(sheet).getByRole("link", { name: /^Audit/ });
    // Followed, but kept on this page: jsdom does not go anywhere.
    audit.addEventListener("click", (event) => event.preventDefault());
    await userEvent.click(audit);
    expect(screen.queryByRole("dialog", { name: "More" })).not.toBeInTheDocument();
  });

  it("shows the next screen's skeleton once it is slow, the navigation kept", () => {
    vi.useFakeTimers();
    try {
      const { side } = shell();
      act(() => {
        startNavigation();
        vi.advanceTimersByTime(SLOW_MS);
      });
      expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
      expect(within(side).getByRole("link", { name: "Clinics" })).toBeInTheDocument();
      act(() => settleNavigation());
      expect(screen.getByRole("main")).not.toHaveAttribute("aria-busy");
    } finally {
      vi.useRealTimers();
    }
  });

  it("draws nothing of the console for someone not yet known, and More has no one to name", () => {
    auth.current = authStub({ status: "loading", profile: null, membership: null, subscription: null });
    render(
      <Providers>
        <ConsoleShell>
          <h1>Overview</h1>
        </ConsoleShell>
      </Providers>,
    );
    expect(screen.getByRole("status", { name: "Checking who is signed in…" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Account: /, hidden: true })).not.toBeInTheDocument();
  });
});
