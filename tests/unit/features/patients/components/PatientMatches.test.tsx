import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aPatientMatch } from "@tests/support/patients";

const matches = vi.hoisted(() => ({ current: { data: undefined as unknown } }));
vi.mock("@/features/patients/hooks/usePatientMatches", () => ({ usePatientMatches: () => matches.current }));

const { PatientMatches } = await import("@/features/patients/components/PatientMatches");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("PatientMatches (D106)", () => {
  it("lists the patients already on the mobile, each to open, the archived marked", () => {
    matches.current = {
      data: [
        aPatientMatch({ id: "p-8", number: 1008, name: "Riya Mehta", dateOfBirth: "2020-02-03" }),
        aPatientMatch({ archived: true }),
      ],
    };
    render(<PatientMatches typed="98765 43210" />);
    const found = screen.getByRole("region", { name: "Already here? 2 patients have this mobile" });
    expect(within(found).getByText(/families often share a number/)).toBeInTheDocument();
    expect(within(found).getByRole("link", { name: "Riya Mehta" })).toHaveAttribute("href", "/patients/p-8");
    expect(within(found).getByText("6 y · Female · P-1008")).toBeInTheDocument();
    expect(within(found).getByRole("link", { name: "Anita Mehta" }).closest("li")).toHaveTextContent("Archived");
  });

  it("says one in the singular, and nothing at all when there are none", () => {
    matches.current = { data: [aPatientMatch()] };
    const { rerender } = render(<PatientMatches typed="98765 43210" />);
    expect(screen.getByRole("region", { name: "Already here? 1 patient has this mobile" })).toBeInTheDocument();
    matches.current = { data: [] };
    rerender(<PatientMatches typed="98765 43210" />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    matches.current = { data: undefined };
    rerender(<PatientMatches typed="98765" />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
