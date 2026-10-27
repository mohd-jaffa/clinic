import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aDailyReport } from "@tests/support/reports";
import { Providers } from "@tests/support/providers";

const { report } = vi.hoisted(() => ({ report: { current: {} as { data?: unknown; error?: unknown } } }));
vi.mock("@/features/reports/hooks/useDailyReport", () => ({ useDailyReport: () => report.current }));
vi.mock("@/lib/dates/calendar", async (actual) => ({
  ...(await actual<typeof import("@/lib/dates/calendar")>()),
  todayKey: () => "2026-10-27",
}));

const { DailyReport } = await import("@/features/reports/components/DailyReport");

const figure = (section: string, label: string) =>
  within(screen.getByRole("region", { name: section }))
    .getByText(label)
    .closest("div")!;

beforeEach(() => {
  report.current = { data: aDailyReport() };
});

describe("DailyReport (plan §18; D346, D356)", () => {
  it("shows the day's patients and appointments, and its money", () => {
    render(<DailyReport day="2026-10-27" onDay={vi.fn()} />, { wrapper: Providers });
    expect(figure("Patients and appointments", "Patients seen")).toHaveTextContent("9");
    expect(figure("Patients and appointments", "Appointments")).toHaveTextContent("12");
    expect(figure("Patients and appointments", "Completed")).toHaveTextContent("9");
    expect(figure("Patients and appointments", "Cancelled")).toHaveTextContent("2");
    expect(figure("Patients and appointments", "No-shows")).toHaveTextContent("1");
    expect(figure("Money", "Collected")).toHaveTextContent("₹12,500");
    expect(figure("Money", "Billed")).toHaveTextContent("₹14,800");
    expect(figure("Money", "Expenses")).toHaveTextContent("₹2,500");
    expect(figure("Money", "Net")).toHaveTextContent("₹10,000");
  });

  it("counts a status with none as nothing", () => {
    report.current = { data: aDailyReport({ statuses: {} }) };
    render(<DailyReport day="2026-10-27" onDay={vi.fn()} />, { wrapper: Providers });
    for (const label of ["Completed", "Cancelled", "No-shows"]) {
      expect(figure("Patients and appointments", label)).toHaveTextContent("0");
    }
  });

  it("steps back a day, and none past today", async () => {
    const onDay = vi.fn();
    render(<DailyReport day="2026-10-27" onDay={onDay} />, { wrapper: Providers });
    expect(screen.getByRole("button", { name: "Next day" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(onDay).toHaveBeenCalledWith("2026-10-26");
  });
});
