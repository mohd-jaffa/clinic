import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Dashboard } from "@/features/dashboard/types";
import { aDashboard } from "@tests/support/dashboard";
import { Providers } from "@tests/support/providers";

vi.mock("@/lib/dates/calendar", async (actual) => ({
  ...(await actual<typeof import("@/lib/dates/calendar")>()),
  todayKey: () => "2026-10-27",
}));

const { HomeSections } = await import("@/features/dashboard/components/HomeSections");

const draw = (home: Dashboard = aDashboard()) => render(<HomeSections home={home} />, { wrapper: Providers });
const section = (name: RegExp) => screen.getByRole("region", { name });
const link = (where: HTMLElement, name: string) => within(where).getByRole("link", { name });

describe("HomeSections (plan §17, §32.1; D349, D351)", () => {
  it("lays the sections out in order: the queue, To bill, follow-ups, tomorrow, owing, payments, expenses", () => {
    draw();
    expect(screen.getAllByRole("region").map((region) => region.querySelector("h2")!.firstChild!.textContent)).toEqual([
      "Today’s queue",
      "To bill",
      "Follow-ups due today",
      "Tomorrow",
      "Owing most",
      "Recent payments",
      "Recent expenses",
    ]);
  });

  it("shows each doctor's queue: how many are in and wait, and the next waiting by token, opening the patient", () => {
    draw();
    const queue = section(/^Today’s queue/);
    expect(within(queue).getByRole("heading", { level: 2 })).toHaveTextContent("Today’s queue3");
    expect(within(queue).getByRole("heading", { name: "Arun Nair · 1 waiting" })).toBeInTheDocument();
    expect(
      within(queue).getByRole("heading", { name: "Maya Rao · 1 with the doctor · 2 waiting" }),
    ).toBeInTheDocument();
    const arun = within(queue).getByRole("list", { name: "Waiting for Arun Nair" });
    expect(within(arun).getByText("07")).toBeInTheDocument();
    expect(within(arun).getByText("Urgent")).toBeInTheDocument();
    expect(link(arun, "Meera Pillai")).toHaveAttribute("href", "/patients/p-2");
    expect(link(queue, "Open queue")).toHaveAttribute("href", "/queue");
  });

  it("lists To bill, the follow-ups due today with the overdue and lapsed, tomorrow and who owes, each opening the patient", () => {
    draw();
    const toBill = section(/^To bill/);
    expect(within(toBill).getByText("P-1001 · Maya Rao · #4")).toBeInTheDocument();
    expect(link(toBill, "Rohan Mehta")).toHaveAttribute("href", "/patients/p-1");
    expect(link(toBill, "Open billing’s To bill")).toHaveAttribute("href", "/billing");

    const followUps = section(/^Follow-ups due today/);
    expect(within(followUps).getByText("2 overdue · 1 lapsed")).toBeInTheDocument();
    expect(within(followUps).getByText("Root canal · Maya Rao")).toBeInTheDocument();
    expect(link(followUps, "View all follow-ups")).toHaveAttribute("href", "/follow-ups");

    const tomorrow = section(/^Tomorrow/);
    expect(within(tomorrow).getByText("10:30 AM")).toBeInTheDocument();
    expect(within(tomorrow).getByText("Consultation · Maya Rao")).toBeInTheDocument();
    expect(link(tomorrow, "Open appointments")).toHaveAttribute("href", "/appointments");

    const owing = section(/^Owing most/);
    expect(within(owing).getByText("₹300 due")).toBeInTheDocument();
    expect(link(owing, "Rohan Mehta")).toHaveAttribute("href", "/patients/p-1");
  });

  it("lists the last payments, opening the patient, and the last expenses, opening Expenses", () => {
    draw();
    const payments = section(/^Recent payments/);
    expect(within(payments).getByText("Paid ₹500 · UPI")).toBeInTheDocument();
    expect(link(payments, "Meera Pillai")).toHaveAttribute("href", "/patients/p-2");
    const expenses = section(/^Recent expenses/);
    expect(within(expenses).getByText("Gauze · Cash · 27 Oct")).toBeInTheDocument();
    expect(within(expenses).getByText("₹250")).toBeInTheDocument();
    expect(link(expenses, "Supplies")).toHaveAttribute("href", "/expenses");
    expect(link(expenses, "Open expenses")).toHaveAttribute("href", "/expenses");
  });

  it("names a doctor no longer on the team, leaves out a token not given, and an expense with no description", () => {
    const home = aDashboard();
    draw({
      ...home,
      toBill: { count: 1, visits: [{ ...home.toBill!.visits[0], doctorName: null, token: null }] },
      expenses: [{ ...home.expenses![0], description: null }],
    });
    expect(within(section(/^To bill/)).getByText("P-1001 · No longer on the team")).toBeInTheDocument();
    expect(within(section(/^Recent expenses/)).getByText("Cash · 27 Oct")).toBeInTheDocument();
  });

  it("says so quietly when a section holds nothing, and leaves out the overdue and lapsed when there are none", () => {
    draw(
      aDashboard({
        queue: [],
        toBill: { count: 0, visits: [] },
        followUps: { today: 0, overdue: 0, lapsed: 0, due: [] },
        upcoming: { count: 0, appointments: [] },
        owing: [],
        payments: [],
        expenses: [],
      }),
    );
    for (const words of [
      "No one is waiting.",
      "Nothing waiting to be billed.",
      "No follow-ups due today.",
      "No appointments tomorrow.",
      "No one owes anything.",
      "No payments yet.",
      "No expenses yet.",
    ]) {
      expect(screen.getByText(words)).toBeInTheDocument();
    }
    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows a doctor's line without a list when no one waits for them", () => {
    draw(aDashboard({ queue: [aDashboard().queue![1]] }));
    expect(screen.getByRole("heading", { name: "Maya Rao · 1 with the doctor · 2 waiting" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Waiting for Maya Rao" })).not.toBeInTheDocument();
  });

  it("shows only the sections the person's permissions open", () => {
    draw(aDashboard({ queue: null, toBill: null, followUps: null, upcoming: null, owing: null, payments: null }));
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(section(/^Recent expenses/)).toBeInTheDocument();
  });
});
