import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aSession, authStub } from "@tests/support/auth";
import { aClosure } from "@tests/support/clinic";
import { Providers } from "@tests/support/providers";

const { auth, client, query } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { add: vi.fn(), remove: vi.fn() },
  query: { current: {} as Record<string, unknown> },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/clinic/api.client", () => ({ ClosuresClient: client }));
vi.mock("@/features/clinic/hooks/useClosures", () => ({ useClosures: () => query.current }));
vi.mock("@/features/team/hooks/useDoctors", () => ({ useDoctors: () => ({ data: [] }) }));

const { Closures } = await import("@/features/clinic/components/Closures");

// By their first day, as the API answers them; today is 3 October 2026.
const closures = [
  aClosure({ id: "h-1", startsOn: "2026-09-09", endsOn: "2026-09-13", reason: "Onam leave", doctorName: "Rahul Nair" }),
  aClosure({ id: "h-2", startsOn: "2026-10-02", endsOn: "2026-10-02", reason: "Gandhi Jayanti" }),
  aClosure({ id: "h-3", startsOn: "2026-10-03", endsOn: "2026-10-04", reason: "Clinic painting" }),
  aClosure({ id: "h-4", startsOn: "2026-10-20", endsOn: "2026-10-22", reason: "Diwali" }),
  aClosure({ id: "h-5", startsOn: "2026-12-28", endsOn: "2027-01-03", reason: "Year end", doctorName: "Rahul Nair" }),
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T06:00:00Z"));
  auth.current = authStub();
  query.current = { data: closures, isLoading: false };
  client.remove.mockImplementation(async (id: string) => closures.find((closure) => closure.id === id));
});
afterEach(() => vi.useRealTimers());

const draw = () =>
  render(
    <Providers>
      <Closures />
    </Providers>,
  );

const rows = (list: string) =>
  within(screen.getByRole("list", { name: list }))
    .getAllByRole("listitem")
    .map((row) => row.textContent);

describe("Closures (plan §9, D84)", () => {
  it("lists those not yet over by their first day — who, when and how many days — and counts them", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Holidays and leave" })).toBeInTheDocument();
    expect(screen.getByText("3 coming up")).toBeInTheDocument();
    expect(rows("Coming up")).toEqual([
      "Clinic paintingWhole clinic · 3 – 4 Oct2 days",
      "DiwaliWhole clinic · 20 – 22 Oct3 days",
      "Year endRahul Nair · 28 Dec 2026 – 3 Jan 20277 days",
    ]);
  });

  it("keeps the past ones behind Show past, the latest first, with nothing to remove", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Show past (2)" }));
    expect(rows("Past")).toEqual([
      "Gandhi JayantiWhole clinic · 2 Oct1 day",
      "Onam leaveRahul Nair · 9 – 13 Sep5 days",
    ]);
    expect(
      within(screen.getByRole("list", { name: "Past" })).queryByRole("button", { name: /^Remove/ }),
    ).not.toBeInTheDocument();
  });

  it("removes one not yet over, asked first", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Remove Diwali" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog", { name: "Remove Diwali?" })).getByRole("button", { name: "Remove" }),
    );
    expect(client.remove).toHaveBeenCalledWith("h-4");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Diwali removed"));
  });

  it("opens the sheet to add one, and puts it away again", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Add holiday or leave" }));
    const sheet = screen.getByRole("dialog", { name: "Add a holiday or leave" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Add a holiday or leave" })).not.toBeInTheDocument(),
    );
  });

  it("says when nothing is coming up, and starts the first from there", async () => {
    query.current = { data: closures.slice(0, 2), isLoading: false };
    draw();
    expect(screen.getByText("None coming up")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No days off coming up" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Coming up" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add holiday or leave" }));
    expect(screen.getByRole("dialog", { name: "Add a holiday or leave" })).toBeInTheDocument();
  });

  it("shows a view-only clinic's closures without Add or Remove, and says why", () => {
    auth.current = authStub({ subscription: { ...aSession().subscription!, state: "READ_ONLY" } });
    draw();
    expect(rows("Coming up")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add holiday or leave" })).not.toBeInTheDocument();
    expect(screen.getByText(/view-only/i)).toBeInTheDocument();
  });

  it("says why when it cannot load", () => {
    query.current = { isLoading: false, error: new Error("down") };
    draw();
    expect(screen.getByText("Holidays and leave couldn't be loaded.")).toBeInTheDocument();
  });
});
