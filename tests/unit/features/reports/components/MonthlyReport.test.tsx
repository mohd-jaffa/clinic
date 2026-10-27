import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aMonthlyReport } from "@tests/support/reports";
import { Providers } from "@tests/support/providers";

const { report } = vi.hoisted(() => ({ report: { current: {} as { data?: unknown; error?: unknown } } }));
vi.mock("@/features/reports/hooks/useMonthlyReport", () => ({ useMonthlyReport: () => report.current }));
vi.mock("@/lib/dates/calendar", async (actual) => ({
  ...(await actual<typeof import("@/lib/dates/calendar")>()),
  todayKey: () => "2026-10-27",
}));

const { MonthlyReport } = await import("@/features/reports/components/MonthlyReport");

const figure = (section: string, label: string) =>
  within(screen.getByRole("region", { name: section }))
    .getByText(label)
    .closest("div")!;

beforeEach(() => {
  report.current = { data: aMonthlyReport() };
});

describe("MonthlyReport (plan §18; D354, D355)", () => {
  it("shows the month's patients, new and returning, its appointments and its money", () => {
    render(<MonthlyReport month="2026-10-01" onMonth={vi.fn()} />, { wrapper: Providers });
    expect(figure("Patients and appointments", "Patients seen")).toHaveTextContent("140");
    expect(figure("Patients and appointments", "New patients")).toHaveTextContent("38");
    expect(figure("Patients and appointments", "Returning patients")).toHaveTextContent("102");
    expect(figure("Patients and appointments", "Appointments")).toHaveTextContent("186");
    expect(figure("Money", "Collected")).toHaveTextContent("₹3,20,000");
    expect(figure("Money", "Net")).toHaveTextContent("₹2,30,000");
    expect(figure("Money", "Outstanding today")).toHaveTextContent("₹12,000");
  });

  it("charts each day's collected and expenses, every value in its table", async () => {
    render(<MonthlyReport month="2026-10-01" onMonth={vi.fn()} />, { wrapper: Providers });
    const chart = screen.getByRole("figure", { name: "Collected and expenses by day" });
    expect(within(chart).getByText("₹20K")).toBeInTheDocument();
    await userEvent.click(within(chart).getByRole("button", { name: "Show as table" }));
    expect(within(chart).getByRole("row", { name: "Thu 1 Oct ₹12,000 ₹9,000" })).toBeInTheDocument();
  });

  it("rings how the month's appointments ended, the cancelled included in the whole", () => {
    render(<MonthlyReport month="2026-10-01" onMonth={vi.fn()} />, { wrapper: Providers });
    const legend = screen.getByRole("list", { name: "Appointment outcomes" });
    expect(
      within(legend)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Completed160 · 84%", "Still to come10 · 5%", "No-shows8 · 4%", "Cancelled12 · 6%"]);
    expect(screen.getByText("190 in all")).toBeInTheDocument();
  });

  it("steps a month back, and none after this one", async () => {
    const onMonth = vi.fn();
    const { unmount } = render(<MonthlyReport month="2026-10-01" onMonth={onMonth} />, { wrapper: Providers });
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(onMonth).toHaveBeenCalledWith("2026-09-01");
    unmount();
    report.current = { data: aMonthlyReport({ month: "2026-09-01" }) };
    render(<MonthlyReport month="2026-09-01" onMonth={onMonth} />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(onMonth).toHaveBeenLastCalledWith("2026-10-01");
  });
});
