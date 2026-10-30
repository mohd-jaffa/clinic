import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { anActivityEntry, change } from "@tests/support/activity";
import { Providers } from "@tests/support/providers";

const { activity, asked, team } = vi.hoisted(() => ({
  activity: { current: {} as Record<string, unknown> },
  asked: [] as [string | null, string | null][],
  team: { current: {} as { data?: unknown } },
}));
vi.mock("@/features/activity/hooks/useActivity", () => ({
  useActivity: (person: string | null, kind: string | null) => {
    asked.push([person, kind]);
    return activity.current;
  },
}));
vi.mock("@/features/team/hooks/useTeam", () => ({ useTeam: () => team.current }));

const { ActivityLog } = await import("@/features/activity/components/ActivityLog");

const draw = () => render(<ActivityLog />, { wrapper: Providers });

/** Today's payment, today's cancellation, and a closure the day before yesterday — by someone gone. */
const entries = [
  anActivityEntry({ id: "a-1", at: "2026-10-31T05:12:00.000Z" }),
  anActivityEntry({
    id: "a-2",
    entityType: "appointments",
    action: "STATUS_CHANGE",
    changes: { status: change("SCHEDULED", "CANCELLED") },
    actorName: "Asha Menon",
    at: "2026-10-31T03:45:00.000Z",
  }),
  anActivityEntry({ id: "a-3", at: "2026-10-30T09:00:00.000Z", actorName: null }),
  anActivityEntry({
    id: "a-4",
    entityType: "services",
    action: "CREATE",
    changes: { name: change(null, "Scaling") },
    patient: null,
    record: null,
    at: "2026-10-28T09:00:00.000Z",
  }),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T08:00:00.000Z"));
  asked.length = 0;
  activity.current = { data: entries };
  team.current = {
    data: [
      { userId: "u-1", name: "Asha Menon" },
      { userId: "u-2", name: "Anu Rao" },
    ],
  };
});

afterEach(() => vi.useRealTimers());

describe("ActivityLog (plan §19; D387 – D390)", () => {
  it("lists who did what under day headings, the latest first, each with its patient and its time", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Activity" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/settings");
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Today",
      "Yesterday",
      "28 Oct",
    ]);
    const [payment, cancelled] = within(screen.getByRole("list", { name: "Today" })).getAllByRole("listitem");
    expect(payment).toHaveTextContent("Recorded a payment of ₹2,000 · UPI");
    expect(payment).toHaveTextContent("Meena Iyer · P-1023");
    expect(payment).toHaveTextContent("Anu Rao · 10:42 AM");
    expect(cancelled).toHaveTextContent("Cancelled an appointment");
    expect(screen.getByRole("list", { name: "Yesterday" })).toHaveTextContent("Someone no longer here · 2:30 PM");
    expect(screen.getByRole("list", { name: "28 Oct" })).toHaveTextContent("Added Scaling to the price list");
  });

  it("keeps the list to a person and a kind", async () => {
    draw();
    expect(asked.at(-1)).toEqual([null, null]);
    await userEvent.click(screen.getByRole("combobox", { name: "Person" }));
    await userEvent.click(screen.getByRole("option", { name: "Anu Rao" }));
    expect(asked.at(-1)).toEqual(["u-2", null]);
    await userEvent.click(screen.getByRole("combobox", { name: "Kind" }));
    await userEvent.click(screen.getByRole("option", { name: "Bills and payments" }));
    expect(asked.at(-1)).toEqual(["u-2", "BILLING"]);
  });

  it("says when nothing matches what it is kept to, and when nothing has been done; the team not yet read", async () => {
    activity.current = { data: [] };
    team.current = {};
    const { unmount } = draw();
    expect(screen.getByText("Nothing has been done yet.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "Kind" }));
    await userEvent.click(screen.getByRole("option", { name: "Team" }));
    expect(screen.getByText("Nothing matches.")).toBeInTheDocument();
    unmount();
  });

  it("opens a row whole, and closes it again", async () => {
    draw();
    await userEvent.click(screen.getAllByRole("button", { name: /Recorded a payment of ₹2,000 · UPI/ })[0]);
    const sheet = screen.getByRole("dialog", { name: "Recorded a payment of ₹2,000 · UPI" });
    expect(sheet).toHaveTextContent("WhoAnu Rao");
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
