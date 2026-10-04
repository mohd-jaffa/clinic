import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Patient } from "@/features/patients/types";
import { authStub } from "@tests/support/auth";
import { aPatient } from "@tests/support/patients";
import { Providers } from "@tests/support/providers";

const { auth, client } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { archive: vi.fn(), restore: vi.fn() },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/patients/api.client", () => ({ PatientsClient: client }));

const { PatientArchived } = await import("@/features/patients/components/PatientArchived");

// 11:30 PM on 3 Oct in UTC is already 4 Oct at the clinic.
const ARCHIVED_AT = "2026-10-03T23:30:00Z";
const archived = aPatient({ archivedAt: ARCHIVED_AT, archivedBy: "Asha Rao" });

const draw = (patient: Patient = archived) =>
  render(
    <Providers>
      <PatientArchived patient={patient} archivedAt={ARCHIVED_AT} />
    </Providers>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  client.restore.mockResolvedValue(aPatient());
});

describe("PatientArchived (D123)", () => {
  it("says when, on the clinic's calendar, and by whom, and that the profile is read-only", () => {
    draw();
    expect(screen.getByText("Archived on 4 Oct 2026 by Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("Their profile is read-only until they are restored.")).toBeInTheDocument();
  });

  it("says when alone once who archived them has gone", () => {
    draw({ ...archived, archivedBy: null });
    expect(screen.getByText("Archived on 4 Oct 2026")).toBeInTheDocument();
  });

  it("restores them at once, unasked, and says so (D125)", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Restore Rohan Mehta" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(client.restore).toHaveBeenCalledWith("p-1"));
    expect(await screen.findByRole("status")).toHaveTextContent("Rohan Mehta restored");
  });

  it("offers no Restore to someone who may only see patients, nor in a view-only clinic", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view"] });
    const { unmount } = draw();
    expect(screen.queryByRole("button", { name: /^Restore/ })).not.toBeInTheDocument();
    unmount();
    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    const second = draw();
    expect(screen.queryByRole("button", { name: /^Restore/ })).not.toBeInTheDocument();
    second.unmount();
    auth.current = { ...authStub(), membership: null };
    draw();
    expect(screen.queryByRole("button", { name: /^Restore/ })).not.toBeInTheDocument();
  });
});
