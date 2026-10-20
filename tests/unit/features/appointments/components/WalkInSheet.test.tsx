import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppointmentType } from "@/features/clinic/types";
import type { PatientListItem } from "@/features/patients/types";
import { ApiError } from "@/lib/api/client";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { client, auth, doctors, types, search, fee } = vi.hoisted(() => ({
  fee: { atArrival: false, offer: vi.fn() },
  client: { addWalkIn: vi.fn() },
  auth: { current: {} as ReturnType<typeof authStub> },
  doctors: { current: [] as { id: string; name: string }[] | undefined },
  types: { current: [] as AppointmentType[] | undefined },
  search: { current: undefined as unknown },
}));
vi.mock("@/features/appointments/api.client", () => ({ AppointmentsClient: client }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/team/hooks/useDoctors", () => ({ useDoctors: () => ({ data: doctors.current }) }));
vi.mock("@/features/clinic/hooks/useAppointmentTypes", () => ({
  useAppointmentTypes: () => ({ data: types.current }),
}));
vi.mock("@/features/patients/hooks/usePatientSearch", () => ({ usePatientSearch: () => ({ data: search.current }) }));
vi.mock("@/features/patients/hooks/usePatientMatches", () => ({ usePatientMatches: () => ({ data: undefined }) }));
vi.mock("@/features/billing/hooks/useFeeAtArrival", () => ({ useFeeAtArrival: () => fee.atArrival }));
vi.mock("@/features/billing/components/FeeCollection", () => ({ useCollectFee: () => fee.offer }));

const { WalkInSheet } = await import("@/features/appointments/components/WalkInSheet");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ROHAN: PatientListItem = {
  id: "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b",
  number: 1012,
  name: "Rohan Mehta",
  phone: "+919876543210",
  dateOfBirth: "1990-04-12",
  gender: "MALE",
  lastVisitOn: null,
  balancePaise: 0,
};
const MAYA = { id: "8c2f5b63-4d6e-4f70-9bac-1d2e3f4a5b6c", name: "Maya Rao" };
const ARUN = { id: "ad417d85-6f80-4192-9dce-3f4a5b6c7d8e", name: "Arun Sen" };
const CONSULTATION = { id: "9d306c74-5e7f-4081-8cbd-2e3f4a5b6c7d", name: "Consultation", minutes: 15, active: true };
const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fee.atArrival = false;
  auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "patients.create", "appointments.create"] });
  doctors.current = [MAYA, ARUN];
  types.current = [CONSULTATION];
  search.current = { items: [ROHAN], nextCursor: null };
  client.addWalkIn.mockResolvedValue({ id: "a-7", patientId: ROHAN.id, doctorId: MAYA.id, token: 7 });
});

/** The sheet as the queue holds it: open until it closes itself. */
function Harness({ doctorId }: { doctorId: string }) {
  const [open, setOpen] = useState(true);
  return (
    <WalkInSheet
      open={open}
      doctorId={doctorId}
      onClose={() => {
        onClose();
        setOpen(false);
      }}
    />
  );
}

const draw = (doctorId = MAYA.id) =>
  render(
    <Providers>
      <Harness doctorId={doctorId} />
    </Providers>,
  );
const sheet = () => screen.getByRole("dialog", { name: "Add a walk-in" });
const add = () => userEvent.click(within(sheet()).getByRole("button", { name: "Add walk-in" }));
const findRohan = async () => {
  await userEvent.type(within(sheet()).getByRole("searchbox"), "roh");
  await userEvent.click(within(sheet()).getByRole("button", { name: "Rohan Mehta" }));
};
const sent = (call = 0) => client.addWalkIn.mock.calls[call][0] as { input: Record<string, unknown>; key: string };

describe("WalkInSheet (plan §11.3; D171, D173, D175)", () => {
  it("starts on the queue's doctor and the clinic's first type, and adds a patient found — once per key — with their token on the card", async () => {
    draw();
    expect(within(sheet()).getByRole("combobox", { name: /^Doctor/ })).toHaveTextContent("Maya Rao");
    expect(within(sheet()).getByRole("combobox", { name: /^Type/ })).toHaveTextContent("Consultation");
    expect(within(sheet()).queryByRole("combobox", { name: /Hour/ })).not.toBeInTheDocument();
    await findRohan();
    await add();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sent()).toEqual({
      input: {
        patient: expect.objectContaining({ mode: "FOUND", id: ROHAN.id }),
        doctorId: MAYA.id,
        typeId: CONSULTATION.id,
      },
      key: expect.stringMatching(UUID),
    });
    expect(screen.getByRole("status")).toHaveTextContent("Rohan Mehta is #7 with Maya Rao");
  });

  it("asks for the patient and the doctor on every doctor's queue with several doctors", async () => {
    draw("");
    expect(within(sheet()).getByRole("combobox", { name: /^Doctor/ })).toHaveTextContent("Choose a doctor");
    await add();
    expect(within(sheet()).getByText("Choose patient.")).toBeInTheDocument();
    expect(within(sheet()).getByText("Choose doctor.")).toBeInTheDocument();
    expect(client.addWalkIn).not.toHaveBeenCalled();
  });

  it("adds a new patient with it, under their own key", async () => {
    draw();
    await userEvent.type(within(sheet()).getByRole("searchbox"), "Meera Pillai");
    await userEvent.click(within(sheet()).getByRole("button", { name: "New patient" }));
    const added = within(sheet()).getByRole("region", { name: "New patient" });
    await userEvent.type(within(added).getByRole("textbox", { name: /^Mobile/ }), "9876543210");
    await userEvent.click(within(added).getByRole("radio", { name: "Age" }));
    await userEvent.type(within(added).getByRole("textbox", { name: /^Age in years/ }), "34");
    await userEvent.click(within(added).getByRole("radio", { name: "Female" }));
    await add();
    await waitFor(() => expect(client.addWalkIn).toHaveBeenCalled());
    expect(sent().input).toMatchObject({
      patient: { mode: "NEW", fullName: "Meera Pillai" },
      patientKey: expect.stringMatching(UUID),
    });
    expect(screen.getByRole("status")).toHaveTextContent("Meera Pillai is #7 with Maya Rao");
  });

  it("names a doctor's leave at the doctor and a holiday on the card, going on with a patient it added (D139, D145)", async () => {
    client.addWalkIn
      .mockRejectedValueOnce(
        new ApiError(422, "APPOINTMENT_ON_CLOSED_DAY", "Closed.", "req_1", {
          reason: "Conference",
          wholeClinic: false,
          patient: ROHAN,
        }),
      )
      .mockRejectedValueOnce(
        new ApiError(422, "APPOINTMENT_ON_CLOSED_DAY", "Closed.", "req_2", { reason: "Diwali", wholeClinic: true }),
      );
    draw();
    await findRohan();
    await add();
    const leave = await screen.findByRole("alertdialog", { name: "Maya Rao is away that day: Conference" });
    await userEvent.click(within(leave).getByRole("button", { name: "Close" }));
    expect(within(sheet()).getByText("Maya Rao is away that day: Conference")).toBeInTheDocument();
    expect(within(sheet()).getByRole("button", { name: "Change Rohan Mehta" })).toBeInTheDocument();
    await add();
    expect(
      await screen.findByRole("alertdialog", { name: "The clinic is closed that day: Diwali" }),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("says plainly when it was not added for another reason, and offers no new patient to someone who may not add one", async () => {
    client.addWalkIn.mockRejectedValue(new ApiError(422, "PATIENT_ARCHIVED", "Archived.", "req_3"));
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "appointments.create"] });
    draw();
    expect(within(sheet()).queryByRole("button", { name: "New patient" })).not.toBeInTheDocument();
    await findRohan();
    await add();
    expect(await screen.findByRole("alertdialog", { name: "The walk-in wasn’t added" })).toHaveTextContent("Archived.");
  });

  it("waits for the doctors and types without failing", () => {
    doctors.current = undefined;
    types.current = undefined;
    auth.current = { ...authStub(), membership: null };
    draw("");
    expect(within(sheet()).getByRole("combobox", { name: /^Type/ })).toHaveTextContent("Choose a type");
  });

  it("adds one for a doctor no longer listed, naming no one on the card", async () => {
    draw("be528e96-7091-42a3-aedf-4a5b6c7d8e9f");
    await findRohan();
    await add();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sent().input).toMatchObject({ doctorId: "be528e96-7091-42a3-aedf-4a5b6c7d8e9f" });
    expect(screen.getByRole("status")).toHaveTextContent("Rohan Mehta is #7 with");
  });
  it("goes on to Collect fee, saying the token there, in a clinic that takes the fee at arrival (D283, D305)", async () => {
    fee.atArrival = true;
    doctors.current = [MAYA];
    draw();
    await findRohan();
    await add();
    await waitFor(() =>
      expect(fee.offer).toHaveBeenCalledWith({
        appointmentId: "a-7",
        patientName: "Rohan Mehta",
        doctorName: "Maya Rao",
        token: 7,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
