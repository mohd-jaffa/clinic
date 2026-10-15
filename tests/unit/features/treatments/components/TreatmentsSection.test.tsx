import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Treatment } from "@/features/treatments/types";
import type { Visit } from "@/features/visits/types";
import { aTreatment } from "@tests/support/treatments";

vi.mock("@/features/treatments/components/TreatmentPanel", () => ({
  TreatmentPanel: ({
    treatment,
    visit,
    open,
  }: {
    treatment: Treatment | null;
    visit: { id: string; open: boolean } | null;
    open: boolean;
  }) =>
    open && treatment ? <div role="dialog" aria-label={`${treatment.name} on ${visit?.id} ${visit?.open}`} /> : null,
}));
vi.mock("@/features/treatments/components/TreatmentForms", () => ({
  NewTreatmentSheet: ({ open, onClose, visitId }: { open: boolean; onClose: () => void; visitId: string | null }) =>
    open ? (
      <div role="dialog" aria-label={`New treatment in ${visitId}`}>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

const { TreatmentsSection } = await import("@/features/treatments/components/TreatmentsSection");

const visitWith = (treatments: Treatment[], status: Visit["status"] = "OPEN") =>
  ({ id: "v-0", status, patient: { id: "p-1", name: "Anita Rao" }, treatments }) as unknown as Visit;

describe("TreatmentsSection (plan §12.2 item 4; D256, D263)", () => {
  it("lists the visit's treatments, each opening its sheet on this visit", async () => {
    render(<TreatmentsSection visit={visitWith([aTreatment()])} writes={false} />);
    const section = screen.getByRole("region", { name: "Treatments" });
    expect(within(section).getByRole("listitem")).toHaveTextContent("This visit: Access opened");
    expect(within(section).queryByRole("button", { name: "Add a treatment for Anita Rao" })).not.toBeInTheDocument();
    await userEvent.click(within(section).getByRole("button", { name: "Root canal" }));
    expect(screen.getByRole("dialog", { name: "Root canal on v-0 true" })).toBeInTheDocument();
  });

  it("says there are none open, and starts one in this visit for whoever writes", async () => {
    render(<TreatmentsSection visit={visitWith([], "COMPLETED")} writes />);
    const section = screen.getByRole("region", { name: "Treatments" });
    expect(section).toHaveTextContent("No open treatments");
    await userEvent.click(within(section).getByRole("button", { name: "Add a treatment for Anita Rao" }));
    expect(screen.getByRole("dialog", { name: "New treatment in v-0" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
