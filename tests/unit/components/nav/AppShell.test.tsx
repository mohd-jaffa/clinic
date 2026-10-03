import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { settleNavigation, SLOW_MS, startNavigation } from "@/lib/navigation/pending";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, place } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  place: { pathname: "/home" },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => place.pathname,
}));

const { AppShell } = await import("@/components/nav/AppShell");

beforeEach(() => {
  auth.current = authStub();
  place.pathname = "/home";
});

function shell() {
  render(
    <Providers>
      <AppShell>
        <h1>Hello, Asha</h1>
      </AppShell>
    </Providers>,
  );
  // Both are drawn; the screen's width shows one (md:hidden, hidden md:flex).
  const [side, bar] = screen.getAllByRole("navigation", { name: "Main" });
  return { side, bar };
}

const names = (scope: HTMLElement, role: "link" | "button") =>
  within(scope)
    .queryAllByRole(role)
    .map((element) => element.textContent);

describe("the frame", () => {
  it("draws the screen in its main region", () => {
    shell();
    expect(within(screen.getByRole("main")).getByRole("heading", { name: "Hello, Asha" })).toBeInTheDocument();
  });

  it("names the clinic at the top of the sidebar", () => {
    shell();
    expect(screen.getByText("Smile Care")).toBeInTheDocument();
  });
});

describe("the rail and the sidebar", () => {
  it("hold every place an owner may open, in three groups, the current one marked", () => {
    const { side } = shell();

    expect(within(side).getAllByRole("list")).toHaveLength(3);
    expect(names(side, "link")).toEqual([
      "Home",
      "Queue",
      "Appointments",
      "Patients",
      "Follow-ups",
      "Billing",
      "Expenses",
      "Reports",
      "Team",
      "Settings",
    ]);
    expect(within(side).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(within(side).getByRole("link", { name: "Queue" })).not.toHaveAttribute("aria-current");
  });

  it("mark the place a screen within it belongs to", () => {
    place.pathname = "/patients/p-1";
    const { side } = shell();
    expect(within(side).getByRole("link", { name: "Patients" })).toHaveAttribute("aria-current", "page");
  });

  it("hold only the places a member may open, dropping a group with none", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "expenses.view"] });
    const { side } = shell();

    expect(names(side, "link")).toEqual(["Home", "Patients", "Expenses", "Settings"]);
    expect(within(side).getAllByRole("list")).toHaveLength(3);

    auth.current = authStub({ role: "STAFF", permissions: ["patients.view"] });
    cleanup();
    const second = shell();
    expect(within(second.side).getAllByRole("list")).toHaveLength(2);
  });
});

describe("the phone's bottom bar", () => {
  it("holds Home, Queue, the ＋, Patients and More, Home current", () => {
    const { bar } = shell();

    expect(names(bar, "link")).toEqual(["Home", "Queue", "Patients"]);
    expect(names(bar, "button")).toEqual(["Add", "More"]);
    expect(within(bar).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the ＋ in the middle for someone without the Queue, and leaves it out for someone who can add nothing", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view"] });
    const { bar } = shell();

    expect(names(bar, "link")).toEqual(["Home", "Patients"]);
    expect(names(bar, "button")).toEqual(["More"]);
    expect(within(bar).getByRole("link", { name: "Patients" }).closest("li")).toHaveClass("col-start-4");
  });

  it("marks More while a screen behind it is shown", () => {
    place.pathname = "/billing";
    const { bar } = shell();
    expect(within(bar).getByRole("button", { name: "More" })).toHaveAttribute("aria-current", "true");

    place.pathname = "/home";
    cleanup();
    const second = shell();
    expect(within(second.bar).getByRole("button", { name: "More" })).not.toHaveAttribute("aria-current");
  });

  it("opens More as a sheet, and closes it", async () => {
    const { bar } = shell();
    const more = within(bar).getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-haspopup", "dialog");

    await userEvent.click(more);

    expect(more).toHaveAttribute("aria-expanded", "true");
    const sheet = screen.getByRole("dialog", { name: "More" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(more).toHaveAttribute("aria-expanded", "false");
  });
});

describe("quick add (D67, D69)", () => {
  it("opens the same Quick Actions from the bar, the rail and the sidebar, with what the person may add", async () => {
    shell();
    const adds = screen.getAllByRole("button", { name: "Add" });
    expect(adds).toHaveLength(3);

    for (const add of adds) {
      await userEvent.click(add);
      expect(add).toHaveAttribute("aria-expanded", "true");
      const lobe = screen.getByRole("dialog", { name: "Add" });
      expect(
        within(lobe)
          .getAllByRole("link")
          .map((link) => link.getAttribute("href")),
      ).toEqual([
        "/queue?add=walk-in",
        "/appointments?add=appointment",
        "/patients?add=patient",
        "/billing?add=payment",
        "/expenses?add=expense",
      ]);
      await userEvent.click(within(lobe).getByRole("button", { name: "Close" }));
      expect(add).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("offers only what the person may add", async () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "patients.create"] });
    const { bar } = shell();

    await userEvent.click(within(bar).getByRole("button", { name: "Add" }));

    expect(names(screen.getByRole("dialog", { name: "Add" }), "link")).toEqual(["Patient"]);
  });
});

describe("while the session is checked", () => {
  it("draws the frame out of sight, with nothing in it yet", () => {
    auth.current = authStub({ status: "loading", profile: null, membership: null });
    render(
      <Providers>
        <AppShell>
          <h1>Hello</h1>
        </AppShell>
      </Providers>,
    );

    expect(screen.getByRole("status", { name: "Checking who is signed in…" })).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toEqual([]);
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
  });
});

describe("on the way to another screen", () => {
  it("shows the next screen's skeleton in this one's place once it is slow, the navigation kept", () => {
    vi.useFakeTimers();
    try {
      const { side } = shell();
      act(() => {
        startNavigation();
        vi.advanceTimersByTime(SLOW_MS);
      });

      const main = screen.getByRole("main");
      expect(main).toHaveAttribute("aria-busy", "true");
      expect(within(main).getByRole("status", { name: "Loading…" })).toBeInTheDocument();
      expect(within(side).getByRole("link", { name: "Home" })).toBeInTheDocument();

      act(() => settleNavigation());
      expect(main).not.toHaveAttribute("aria-busy");
      expect(within(main).queryByRole("status")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
