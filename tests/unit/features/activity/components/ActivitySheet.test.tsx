import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActivitySheet } from "@/features/activity/components/ActivitySheet";
import { anActivityEntry, change } from "@tests/support/activity";
import { Providers } from "@tests/support/providers";

const draw = (entry = anActivityEntry()) =>
  render(<ActivitySheet entry={entry} onClose={vi.fn()} />, { wrapper: Providers });

describe("ActivitySheet (D389)", () => {
  it("says who did it and when, the patient with Open patient, and everything it changed", () => {
    draw();
    const sheet = screen.getByRole("dialog", { name: "Recorded a payment of ₹2,000 · UPI" });
    expect(sheet).toHaveTextContent("WhoAnu Rao");
    expect(sheet).toHaveTextContent(/When30 Oct 2026, 10:42 AM/);
    expect(sheet).toHaveTextContent("PatientMeena Iyer · P-1023");
    expect(sheet).toHaveTextContent("Amount₹2,000");
    expect(sheet).toHaveTextContent("MethodUPI");
    expect(within(sheet).getByRole("link", { name: "Open patient" })).toHaveAttribute("href", "/patients/p-1");
  });

  it("says someone no longer here, and offers no patient for a row without one", () => {
    draw(
      anActivityEntry({
        entityType: "clinics",
        action: "UPDATE",
        changes: { city: change("Kochi", "Kollam") },
        patient: null,
        actorName: null,
      }),
    );
    const sheet = screen.getByRole("dialog", { name: "Changed the clinic’s details" });
    expect(sheet).toHaveTextContent("WhoSomeone no longer here");
    expect(sheet).not.toHaveTextContent("Patient");
    expect(sheet).toHaveTextContent("CityKochi → Kollam");
    expect(within(sheet).queryByRole("link")).not.toBeInTheDocument();
  });
});
