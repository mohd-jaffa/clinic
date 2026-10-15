import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/constants/permissions";
import { ApiError } from "@/lib/api/client";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { client, router, auth, doctors } = vi.hoisted(() => ({
  client: { start: vi.fn() },
  router: { push: vi.fn() },
  auth: { current: {} as ReturnType<typeof authStub> },
  doctors: { current: undefined as { id: string; name: string }[] | undefined },
}));
vi.mock("@/features/visits/api.client", () => ({ VisitsClient: client }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/team/hooks/useDoctors", () => ({ useDoctors: () => ({ data: doctors.current }) }));

const { NewVisit } = await import("@/features/visits/components/NewVisit");

const STARTS: Permission[] = ["patients.view", "visits.view", "visits.create"];
const PATIENT = "0b6f2a1e-3c4d-4e5f-8a9b-1c2d3e4f5a6b";
const MAYA = { id: "1c7a3b2f-4d5e-4f60-9a1b-2c3d4e5f6a7b", name: "Maya Rao" };
const ARUN = { id: "2d8b4c3a-5e6f-4a71-8b2c-3d4e5f6a7b8c", name: "Arun Sen" };

/** A member of the given role and permissions, with or without a doctor of their own. */
const member = (role: "OWNER" | "DOCTOR" | "STAFF", permissions: Permission[], doctorId: string | null) => {
  const stub = authStub({ role, permissions });
  return { ...stub, membership: { ...stub.membership!, doctorId } };
};

const draw = (archivedAt: string | null = null) =>
  render(
    <Providers>
      <NewVisit patient={{ id: PATIENT, name: "Asha Iyer", archivedAt }} />
    </Providers>,
  );
const newVisit = () => screen.queryByRole("button", { name: "New visit" });
const sheet = () => screen.getByRole("dialog", { name: "New visit" });
const doctorField = () => within(sheet()).getByRole("combobox", { name: /^Doctor/ });

beforeEach(() => {
  vi.clearAllMocks();
  doctors.current = [MAYA];
  auth.current = member("STAFF", STARTS, null);
  client.start.mockResolvedValue({ visitId: "v-9", created: true });
});

describe("NewVisit (plan §12.1; D204)", () => {
  it("is offered only to whoever starts and reads visits, while the clinic can write and the patient is not archived", () => {
    const shown = [
      member("STAFF", ["patients.view", "visits.view"], null),
      member("STAFF", ["patients.view", "visits.create"], null),
      { ...member("STAFF", STARTS, null), membership: null },
    ];
    for (const who of shown) {
      auth.current = who;
      const { unmount } = draw();
      expect(newVisit()).not.toBeInTheDocument();
      unmount();
    }
    const viewOnly = member("STAFF", STARTS, null);
    auth.current = { ...viewOnly, subscription: { ...viewOnly.subscription!, state: "READ_ONLY" } };
    const { unmount } = draw();
    expect(newVisit()).not.toBeInTheDocument();
    unmount();

    auth.current = member("STAFF", STARTS, null);
    const archived = draw("2026-10-01T00:00:00Z");
    expect(newVisit()).not.toBeInTheDocument();
    archived.unmount();
    draw();
    expect(newVisit()).toBeInTheDocument();
  });

  it("starts a doctor's own visit at once, and opens it", async () => {
    auth.current = member("DOCTOR", STARTS, MAYA.id);
    draw();
    await userEvent.click(newVisit()!);
    expect(client.start).toHaveBeenCalledWith({ patientId: PATIENT, doctorId: MAYA.id });
    expect(router.push).toHaveBeenCalledWith("/visits/v-9?from=patient");
    expect(screen.queryByRole("dialog", { name: "New visit" })).not.toBeInTheDocument();
  });

  it("names the doctor of a visit already open — or that they are gone from the team", async () => {
    client.start.mockResolvedValue({ visitId: "v-3", created: false });
    auth.current = member("DOCTOR", STARTS, MAYA.id);
    const { unmount } = draw();
    await userEvent.click(newVisit()!);
    expect((await screen.findAllByText("Asha Iyer is already in with Maya Rao"))[0]).toBeInTheDocument();
    unmount();

    doctors.current = undefined;
    draw();
    await userEvent.click(newVisit()!);
    expect((await screen.findAllByText("Asha Iyer is already in with No longer on the team"))[0]).toBeInTheDocument();
  });

  it("asks anyone else for the doctor, the only one already chosen, then starts and closes", async () => {
    draw();
    await userEvent.click(newVisit()!);
    expect(doctorField()).toHaveTextContent("Maya Rao");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Start visit" }));
    await waitFor(() => expect(client.start).toHaveBeenCalledWith({ patientId: PATIENT, doctorId: MAYA.id }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New visit" })).not.toBeInTheDocument());
    expect(router.push).toHaveBeenCalledWith("/visits/v-9?from=patient");
  });

  it("starts on the member's own doctor among several, and on none for someone who is not one", async () => {
    doctors.current = [MAYA, ARUN];
    auth.current = member("OWNER", STARTS, ARUN.id);
    const { unmount } = draw();
    await userEvent.click(newVisit()!);
    expect(doctorField()).toHaveTextContent("Arun Sen");
    unmount();

    auth.current = member("DOCTOR", STARTS, null);
    draw();
    await userEvent.click(newVisit()!);
    expect(doctorField()).toHaveTextContent("Choose a doctor");
  });

  it("refuses to start with no doctor chosen, and stays open when the start is refused", async () => {
    doctors.current = [MAYA, ARUN];
    client.start.mockRejectedValue(new ApiError(422, "DOCTOR_INACTIVE", "Gone."));
    draw();
    await userEvent.click(newVisit()!);
    await userEvent.click(within(sheet()).getByRole("button", { name: "Start visit" }));
    expect(await within(sheet()).findByText("Choose doctor.")).toBeInTheDocument();
    expect(client.start).not.toHaveBeenCalled();

    await userEvent.click(doctorField());
    await userEvent.click(screen.getByRole("option", { name: "Arun Sen" }));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Start visit" }));
    await waitFor(() => expect(client.start).toHaveBeenCalledWith({ patientId: PATIENT, doctorId: ARUN.id }));
    const refused = await screen.findByRole("alertdialog", { name: "The visit wasn’t started" });
    await userEvent.click(within(refused).getByRole("button", { name: "Close" }));
    expect(sheet()).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("closes without starting", async () => {
    draw();
    await userEvent.click(newVisit()!);
    await userEvent.click(within(sheet()).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New visit" })).not.toBeInTheDocument());
    expect(client.start).not.toHaveBeenCalled();
  });
});
