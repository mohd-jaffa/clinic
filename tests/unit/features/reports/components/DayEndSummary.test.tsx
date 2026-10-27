import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Collection } from "@/features/reports/types";
import { aDailyReport } from "@tests/support/reports";
import { Providers } from "@tests/support/providers";

const { download } = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock("@/features/documents/hooks/useCollectionsDownload", () => ({
  useCollectionsDownload: () => ({ download, downloading: false }),
}));

const { DayEndSummary } = await import("@/features/reports/components/DayEndSummary");

const COLLECTIONS: Collection[] = [
  {
    receivedBy: "user-1",
    receiverName: "Asha Menon",
    method: "CASH",
    payments: 0,
    receivedPaise: 0,
    refunds: 1,
    refundedPaise: 20_000,
  },
  {
    receivedBy: "user-2",
    receiverName: "Priya Nair",
    method: "CASH",
    payments: 2,
    receivedPaise: 230_000,
    refunds: 0,
    refundedPaise: 0,
  },
  {
    receivedBy: null,
    receiverName: null,
    method: "UPI",
    payments: 1,
    receivedPaise: 100_000,
    refunds: 0,
    refundedPaise: 0,
  },
];

const draw = (changes: Parameters<typeof aDailyReport>[0] = {}) =>
  render(
    <DayEndSummary
      report={aDailyReport({
        collections: COLLECTIONS,
        voided: { payments: 1, paymentPaise: 30_000, refunds: 0, refundPaise: 0 },
        ...changes,
      })}
    />,
    { wrapper: Providers },
  );

beforeEach(() => vi.clearAllMocks());

describe("DayEndSummary (plan §18; D49, D357 – D360)", () => {
  it("shows a card for each person: their lines, and the cash they hand over", () => {
    draw();
    const people = within(screen.getByRole("list", { name: "By person" })).getAllByRole("listitem");
    expect(people.map((person) => person.textContent)).toEqual([
      "Asha MenonRefunded, Cash−₹200Cash to hand over−₹200",
      "Priya NairCash₹2,300Cash to hand over₹2,300",
      "No longer on the teamUPI₹1,000Cash to hand over₹0",
    ]);
  });

  it("totals each method, the net collected, and what was voided", () => {
    draw();
    const table = screen.getByRole("table", { name: "By method" });
    expect(within(table).getByRole("row", { name: "Cash ₹2,300 ₹200 ₹2,100" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: "UPI ₹1,000 ₹0 ₹1,000" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: "Net collected ₹3,100" })).toBeInTheDocument();
    expect(screen.getByText("Voided: 1 payment, ₹300")).toBeInTheDocument();
  });

  it("prints the day as a PDF beside the app, and downloads it", async () => {
    draw();
    expect(screen.getByRole("link", { name: "Print the day-end collections of 27 Oct 2026" })).toHaveAttribute(
      "href",
      "/api/reports/daily/collections.pdf?day=2026-10-27",
    );
    await userEvent.click(screen.getByRole("button", { name: "Download the day-end collections of 27 Oct 2026" }));
    expect(download).toHaveBeenCalled();
  });

  it("says so on a day with no payments, still printable, and leaves out voids when there are none", () => {
    draw({ collections: [], voided: { payments: 0, paymentPaise: 0, refunds: 0, refundPaise: 0 } });
    expect(screen.getByText("No payments this day.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Print/ })).toBeInTheDocument();
    expect(screen.queryByText(/^Voided/)).not.toBeInTheDocument();
  });

  it("leaves out the voided line when nothing of the day was voided", () => {
    draw({ voided: { payments: 0, paymentPaise: 0, refunds: 0, refundPaise: 0 } });
    expect(screen.queryByText(/^Voided/)).not.toBeInTheDocument();
  });
});
