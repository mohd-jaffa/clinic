import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UI_TEXT } from "@/constants/messages";
import type { PatientSummary } from "@/features/patients/types";
import type { Treatment } from "@/features/treatments/types";
import { authStub } from "@tests/support/auth";
import { aPatient } from "@tests/support/patients";
import { Providers } from "@tests/support/providers";
import { aTreatment } from "@tests/support/treatments";

const { auth, summary, adding } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  summary: { current: {} as { data?: PatientSummary; error?: unknown; mutate: () => void; isValidating: boolean } },
  adding: { firstDoctor: "" },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/patients/hooks/usePatientSummary", () => ({ usePatientSummary: () => summary.current }));
vi.mock("@/features/treatments/components/TreatmentPanel", () => ({
  TreatmentPanel: ({ treatment, open, writes }: { treatment: Treatment | null; open: boolean; writes: boolean }) =>
    open && treatment ? <div role="dialog" aria-label={`${treatment.name}, ${writes}`} /> : null,
}));
vi.mock("@/features/treatments/components/TreatmentForms", () => ({
  NewTreatmentSheet: ({ open, onClose, firstDoctor }: { open: boolean; onClose: () => void; firstDoctor: string }) => {
    adding.firstDoctor = firstDoctor;
    return open ? (
      <div role="dialog" aria-label="New treatment">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null;
  },
}));

const { PatientTreatments } = await import("@/features/treatments/components/PatientTreatments");

const CLINICAL = ["patients.view", "visits.view", "visits.edit"] as const;
const read = (treatments?: Treatment[], error?: unknown) => {
  summary.current = { data: treatments && { treatments }, error, mutate: vi.fn(), isValidating: false };
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub({ role: "STAFF", permissions: [...CLINICAL] });
  read([]);
});

const draw = (patient = aPatient()) =>
  render(
    <Providers>
      <PatientTreatments patient={patient} />
    </Providers>,
  );
const section = () => screen.getByRole("region", { name: "Treatments" });

describe("PatientTreatments (plan §10.3 item 3; D260, D261)", () => {
  it("lists the open ones, then Show closed for the rest, each opening its sheet", async () => {
    read([aTreatment({ id: "a", name: "Crown", status: "CANCELLED", cancelledOn: "2026-10-01" }), aTreatment()]);
    draw();
    const open = within(section()).getByRole("list", { name: "Treatments" });
    expect(within(open).getByRole("listitem")).toHaveTextContent("Root canal");
    await userEvent.click(within(section()).getByRole("button", { name: "Show closed (1)" }));
    await userEvent.click(within(section()).getByRole("button", { name: "Crown" }));
    expect(screen.getByRole("dialog", { name: "Crown, true" })).toBeInTheDocument();
  });

  it("says when none is open, with nothing closed to show", () => {
    draw();
    expect(section()).toHaveTextContent("No open treatments");
    expect(within(section()).queryByRole("button", { name: /^Show closed/ })).not.toBeInTheDocument();
  });

  it("adds one for visits.edit, for the caller as a doctor — or the patient's own doctor", async () => {
    auth.current = authStub({ role: "DOCTOR", permissions: [...CLINICAL] });
    draw();
    await userEvent.click(within(section()).getByRole("button", { name: "Add a treatment for Rohan Mehta" }));
    expect(screen.getByRole("dialog", { name: "New treatment" })).toBeInTheDocument();
    expect(adding.firstDoctor).toBe("doctor-1");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const staff = authStub({ role: "STAFF", permissions: [...CLINICAL] });
    auth.current = { ...staff, membership: { ...staff.membership!, doctorId: null } };
    draw(aPatient({ assignedDoctorId: "d-9" }));
    expect(adding.firstDoctor).toBe("d-9");
    draw(aPatient({ assignedDoctorId: null }));
    expect(adding.firstDoctor).toBe("");
  });

  it("offers no Add to whoever may only read, an archived patient, or a view-only clinic", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "visits.view"] });
    draw();
    const viewOnly = authStub({ role: "STAFF", permissions: [...CLINICAL] });
    auth.current = { ...viewOnly, subscription: { ...viewOnly.subscription!, state: "READ_ONLY" } };
    draw();
    auth.current = authStub({ role: "STAFF", permissions: [...CLINICAL] });
    draw(aPatient({ archivedAt: "2026-10-01T00:00:00Z" }));
    expect(screen.queryByRole("button", { name: /^Add a treatment/ })).not.toBeInTheDocument();
    auth.current = { ...auth.current, membership: null };
    draw();
    expect(screen.queryByRole("button", { name: /^Add a treatment/ })).not.toBeInTheDocument();
  });

  it("stands in while they load, and says why they couldn't be", () => {
    read(undefined);
    draw();
    expect(within(section()).getByLabelText(UI_TEXT.states.loading)).toBeInTheDocument();
    read(undefined, new Error("down"));
    draw();
    expect(screen.getAllByRole("region", { name: "Treatments" })[1]).toHaveTextContent(
      "The treatments couldn't be loaded.",
    );
  });
});
