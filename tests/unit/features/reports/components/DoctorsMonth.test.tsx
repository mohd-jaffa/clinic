import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DoctorsMonth } from "@/features/reports/components/DoctorsMonth";
import type { DoctorMonth } from "@/features/reports/types";

const DOCTORS: DoctorMonth[] = [
  { doctorId: "d-2", doctorName: "Arun Nair", patientsSeen: 1, visits: 1, billedPaise: 120_000, paidPaise: 100_000 },
  {
    doctorId: "d-1",
    doctorName: "Maya Rao",
    patientsSeen: 12,
    visits: 18,
    billedPaise: 2_000_000,
    paidPaise: 2_000_000,
  },
  { doctorId: "d-3", doctorName: null, patientsSeen: 2, visits: 2, billedPaise: 0, paidPaise: 0 },
  { doctorId: null, doctorName: null, patientsSeen: 0, visits: 0, billedPaise: 30_000, paidPaise: 0 },
];

describe("DoctorsMonth (plan §18; D53, D361, D362)", () => {
  it("gives each doctor a row: patients and visits, billed and paid to date, and what is due in coral", () => {
    render(<DoctorsMonth doctors={DOCTORS} />);
    const rows = within(screen.getByRole("list", { name: "By doctor" })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Arun Nair1 patient · 1 visit₹1,200 billed · ₹1,000 paid₹200 due",
      "Maya Rao12 patients · 18 visits₹20,000 billed · ₹20,000 paid",
      "No longer on the team2 patients · 2 visits₹0 billed · ₹0 paid",
      "No doctor₹300 billed · ₹0 paid₹300 due",
    ]);
    expect(within(rows[0]).getByText("₹200 due")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("says so in a month with no visits or bills", () => {
    render(<DoctorsMonth doctors={[]} />);
    expect(screen.getByRole("region", { name: "By doctor" })).toHaveTextContent("No visits or bills this month.");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
