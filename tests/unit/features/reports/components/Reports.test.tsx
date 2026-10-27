import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Providers } from "@tests/support/providers";

vi.mock("@/features/reports/components/DailyReport", () => ({
  DailyReport: ({ day, onDay }: { day: string; onDay: (day: string) => void }) => (
    <button type="button" onClick={() => onDay("2026-10-20")}>{`Daily ${day}`}</button>
  ),
}));
vi.mock("@/features/reports/components/MonthlyReport", () => ({
  MonthlyReport: ({ month, onMonth }: { month: string; onMonth: (month: string) => void }) => (
    <button type="button" onClick={() => onMonth("2026-09-01")}>{`Monthly ${month}`}</button>
  ),
}));
vi.mock("@/lib/dates/calendar", async (actual) => ({
  ...(await actual<typeof import("@/lib/dates/calendar")>()),
  todayKey: () => "2026-10-27",
}));

const { Reports } = await import("@/features/reports/components/Reports");

describe("Reports (plan §18)", () => {
  it("opens on today's report under its title, and keeps the day and month picked across the tabs", async () => {
    render(<Reports />, { wrapper: Providers });
    expect(screen.getByRole("heading", { level: 1, name: "Reports" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Daily" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("button", { name: "Daily 2026-10-27" }));
    await userEvent.click(screen.getByRole("tab", { name: "Monthly" }));
    await userEvent.click(screen.getByRole("button", { name: "Monthly 2026-10-01" }));
    expect(screen.getByRole("button", { name: "Monthly 2026-09-01" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Daily" }));
    expect(screen.getByRole("button", { name: "Daily 2026-10-20" })).toBeInTheDocument();
  });
});
