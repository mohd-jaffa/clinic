import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RowList } from "@/components/ui/row";
import { ToBillRow } from "@/features/billing/components/ToBillRow";
import type { ToBillVisit } from "@/features/billing/types";
import { todayKey } from "@/lib/dates/calendar";

const visit: ToBillVisit = {
  visitId: "v-1",
  day: todayKey(),
  completedAt: null,
  patient: { id: "p-1", name: "Asha Rao", number: 1042, archived: false },
  doctor: { id: "d-1", name: "Maya Rao" },
  appointmentId: "a-1",
  token: 7,
  treatments: ["Root canal"],
  feePaid: true,
};

const draw = (props: Partial<Parameters<typeof ToBillRow>[0]> = {}) => {
  const onOpen = vi.fn();
  render(
    <RowList label="To bill">
      <ToBillRow visit={visit} showDoctor canBill onOpen={onOpen} {...props} />
    </RowList>,
  );
  return onOpen;
};

describe("ToBillRow (plan §15.6; D318, D319)", () => {
  it("names the patient, doctor, token and what was done, Fee paid, and opens its sheet from its one Bill", async () => {
    const onOpen = draw();
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("Maya Rao · #7");
    expect(row).toHaveTextContent("Root canal");
    expect(within(row).getByText("Fee paid")).toBeInTheDocument();
    await userEvent.click(within(row).getByRole("button", { name: "Check out Asha Rao’s visit" }));
    expect(onOpen).toHaveBeenCalledWith(visit);
    await userEvent.click(within(row).getByRole("button", { name: "Asha Rao" }));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("has no Bill for someone who may not bill, nor for an archived patient", () => {
    draw({ canBill: false });
    expect(screen.queryByRole("button", { name: /^Check out/ })).not.toBeInTheDocument();
  });

  it("has no Bill for an archived patient, and no Fee paid when it was not", () => {
    draw({ visit: { ...visit, feePaid: false, patient: { ...visit.patient, archived: true } } });
    expect(screen.queryByRole("button", { name: /^Check out/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Fee paid")).not.toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Consultation · Root canal");
  });
});
