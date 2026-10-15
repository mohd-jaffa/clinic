import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TreatmentRows } from "@/features/treatments/components/TreatmentRows";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { aTreatment } from "@tests/support/treatments";

const year = todayKey().slice(0, 4);

describe("TreatmentRows (D256, D260)", () => {
  it("names each with its doctor, when it is next due, its estimate and its status, opening it", async () => {
    const onOpen = vi.fn();
    const due = aTreatment({ nextDueOn: addDaysKey(todayKey(), 7) });
    render(<TreatmentRows label="Treatments" treatments={[due]} onOpen={onOpen} />);
    const row = within(screen.getByRole("list", { name: "Treatments" })).getByRole("listitem");
    expect(row).toHaveTextContent("Root canalMaya Rao · Due in 7 days · Est. ₹4,500In progress");
    await userEvent.click(within(row).getByRole("button", { name: "Root canal" }));
    expect(onOpen).toHaveBeenCalledWith(due);
  });

  it("says when a closed one closed, and nothing of when it is due or its doctor once gone", () => {
    render(
      <TreatmentRows
        label="Closed"
        treatments={[
          aTreatment({ id: "a", status: "COMPLETED", completedOn: `${year}-10-01`, estimatedCostPaise: null }),
          aTreatment({ id: "b", status: "CANCELLED", cancelledOn: `${year}-09-20`, doctorName: null }),
          aTreatment({ id: "c", status: "CANCELLED", estimatedCostPaise: null }),
          aTreatment({ id: "d", status: "PLANNED", estimatedCostPaise: null }),
        ]}
        onOpen={vi.fn()}
      />,
    );
    const [completed, cancelled, unstamped, planned] = screen.getAllByRole("listitem");
    expect(completed).toHaveTextContent("Maya Rao · Completed 1 OctCompleted");
    expect(cancelled).toHaveTextContent("No longer on the team · Cancelled 20 Sep · Est. ₹4,500Cancelled");
    expect(unstamped).toHaveTextContent("Root canalMaya RaoCancelled");
    expect(planned).toHaveTextContent("Root canalMaya RaoPlanned");
  });

  it("on a visit's card, says what this visit did for it — or that it began here", () => {
    render(
      <TreatmentRows
        label="Treatments"
        visitId="v-0"
        treatments={[
          aTreatment(),
          aTreatment({ id: "b", name: "Crown", sessions: [], startedVisitId: "v-0" }),
          aTreatment({ id: "c", name: "Scaling", sessions: [{ ...aTreatment().sessions[0], note: null }] }),
          aTreatment({ id: "d", name: "Braces", sessions: [], startedVisitId: "v-9" }),
        ]}
        onOpen={vi.fn()}
      />,
    );
    const [worked, begun, noted, other] = screen.getAllByRole("listitem");
    expect(worked).toHaveTextContent("This visit: Access opened");
    expect(begun).toHaveTextContent("Started this visit");
    expect(noted).toHaveTextContent("Worked on this visit");
    expect(other).not.toHaveTextContent("visit");
  });
});
