import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppointmentType } from "@/features/clinic/types";
import type { PatientListItem } from "@/features/patients/types";
import { ApiError } from "@/lib/api/client";
import { dayTime } from "@/lib/dates/calendar";
import { anAppointmentDetail } from "@tests/support/appointments";
import { authStub } from "@tests/support/auth";
import { aPatientMatch } from "@tests/support/patients";
import { Providers } from "@tests/support/providers";

const { client, auth, doctors, types, search, matches } = vi.hoisted(() => ({
  client: { book: vi.fn(), change: vi.fn() },
  auth: { current: {} as ReturnType<typeof authStub> },
  doctors: { current: [] as { id: string; name: string }[] | undefined },
  types: { current: [] as AppointmentType[] | undefined },
  search: { current: undefined as unknown },
  matches: { current: undefined as unknown },
}));
vi.mock("@/features/appointments/api.client", () => ({ AppointmentsClient: client }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/team/hooks/useDoctors", () => ({ useDoctors: () => ({ data: doctors.current }) }));
vi.mock("@/features/clinic/hooks/useAppointmentTypes", () => ({
  useAppointmentTypes: () => ({ data: types.current }),
}));
vi.mock("@/features/patients/hooks/usePatientSearch", () => ({ usePatientSearch: () => ({ data: search.current }) }));
vi.mock("@/features/patients/hooks/usePatientMatches", () => ({
  usePatientMatches: () => ({ data: matches.current }),
}));
vi.mock("@/features/appointments/hooks/useBookedTimes", () => ({ useBookedTimes: () => ({ data: [] }) }));

const { BookingSheet } = await import("@/features/appointments/components/BookingSheet");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ROHAN: PatientListItem = {
  id: "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b",
  number: 1012,
  name: "Rohan Mehta",
  phone: "+919876543210",
  dateOfBirth: "1990-04-12",
  gender: "MALE",
};
const RAHUL = { id: "8c2f5b63-4d6e-4f70-9bac-1d2e3f4a5b6c", name: "Rahul Nair" };
const MAYA = { id: "doctor-1", name: "Maya Rao" };
const CONSULTATION = { id: "9d306c74-5e7f-4081-8cbd-2e3f4a5b6c7d", name: "Consultation", minutes: 15, active: true };
const REVIEW = { id: "ad417d85-6f80-4192-9dce-3f4a5b6c7d8e", name: "Review", minutes: 25, active: true };
const OLD = { id: "be528e96-7091-42a3-aedf-4a5b6c7d8e9f", name: "Old", minutes: 10, active: false };
const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // Now, in Kochi: Sunday 11 October 2026, 2:00 PM.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T08:30:00Z"));
  auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "patients.create", "appointments.create"] });
  doctors.current = [RAHUL];
  types.current = [OLD, CONSULTATION, REVIEW];
  search.current = { items: [ROHAN], nextCursor: null };
  matches.current = undefined;
  client.book.mockImplementation(
    async ({ input }: { input: { date: string; time: { hour: string; minute: string } } }) => ({
      id: "a-1",
      patientId: ROHAN.id,
      scheduledAt: dayTime(input.date, `${input.time.hour}:${input.time.minute}`),
      minutes: 15,
    }),
  );
});
afterEach(() => vi.useRealTimers());

/** The sheet as the screen holds it: open until it closes itself. */
function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <BookingSheet
      open={open}
      onClose={() => {
        onClose();
        setOpen(false);
      }}
    />
  );
}

const draw = () =>
  render(
    <Providers>
      <Harness />
    </Providers>,
  );

const sheet = () => screen.getByRole("dialog", { name: "Book an appointment" });
const choose = async (name: string | RegExp, option: string) => {
  await userEvent.click(within(sheet()).getByRole("combobox", { name }));
  await userEvent.click(screen.getByRole("option", { name: option }));
};
const findRohan = async () => {
  await userEvent.type(within(sheet()).getByRole("searchbox"), "roh");
  await userEvent.click(within(sheet()).getByRole("button", { name: "Rohan Mehta" }));
};
const book = () => userEvent.click(within(sheet()).getByRole("button", { name: "Book appointment" }));
const sentInput = (call = 0) => (client.book.mock.calls[call][0] as { input: Record<string, unknown> }).input;
const sentKey = (call = 0) => (client.book.mock.calls[call][0] as { key: string }).key;

describe("BookingSheet (plan §11.1; D144 – D151)", () => {
  it("starts on today, the clinic's only doctor and its first type with its length (D149)", () => {
    draw();
    expect(within(sheet()).getByRole("combobox", { name: /^Doctor/ })).toHaveTextContent("Rahul Nair");
    expect(within(sheet()).getByRole("button", { name: /^Date/ })).toHaveTextContent("11 Oct 2026");
    expect(within(sheet()).getByRole("combobox", { name: /^Type/ })).toHaveTextContent("Consultation");
    expect(within(sheet()).getByRole("radio", { name: "15 min" })).toBeChecked();
    expect(within(sheet()).getByRole("combobox", { name: "Time, Hour" })).toHaveTextContent("Hour");
  });

  it("starts on the doctor, day and time of a quarter tapped on the calendar (D156)", () => {
    doctors.current = [RAHUL, MAYA];
    render(
      <Providers>
        <BookingSheet
          open
          onClose={onClose}
          prefill={{ doctorId: RAHUL.id, date: "2026-10-14", time: { hour: "10", minute: "15" } }}
        />
      </Providers>,
    );
    expect(within(sheet()).getByRole("combobox", { name: /^Doctor/ })).toHaveTextContent("Rahul Nair");
    expect(within(sheet()).getByRole("button", { name: /^Date/ })).toHaveTextContent("14 Oct 2026");
    expect(within(sheet()).getByRole("combobox", { name: "Time, Hour" })).toHaveTextContent("10 AM");
    expect(within(sheet()).getByRole("combobox", { name: "Time, Minutes" })).toHaveTextContent(":15");
  });

  it("starts on the doctor booking, among several; with neither, asks for one", () => {
    doctors.current = [RAHUL, MAYA];
    const { unmount } = draw();
    expect(within(sheet()).getByRole("combobox", { name: /^Doctor/ })).toHaveTextContent("Maya Rao");
    unmount();
    const stub = authStub({ role: "STAFF", permissions: ["appointments.create"] });
    auth.current = { ...stub, membership: { ...stub.membership!, doctorId: null } };
    draw();
    expect(within(sheet()).getByRole("combobox", { name: /^Doctor/ })).toHaveTextContent("Choose a doctor");
  });

  it("books a patient found, once per key, and says who, when and with whom", async () => {
    draw();
    await findRohan();
    await choose("Time, Hour", "4 PM");
    await choose("Time, Minutes", ":30");
    await userEvent.type(within(sheet()).getByRole("textbox", { name: /^Notes/ }), "First visit");
    await book();

    await waitFor(() => expect(client.book).toHaveBeenCalled());
    expect(sentInput()).toEqual({
      patient: {
        mode: "FOUND",
        id: ROHAN.id,
        fullName: "",
        phone: "",
        born: { as: "DATE", date: "", years: "" },
        gender: "",
      },
      doctorId: RAHUL.id,
      date: "2026-10-11",
      time: { hour: "16", minute: "30" },
      typeId: CONSULTATION.id,
      length: { choice: "15", other: "" },
      notes: "First visit",
    });
    expect(sentKey()).toMatch(UUID);
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Booked Rohan Mehta · 11 Oct, 4:30 PM with Rahul Nair");
  });

  it("asks for what is missing, in place, and lets go of it once given", async () => {
    draw();
    await book();
    expect(await within(sheet()).findByText("Choose patient.")).toBeInTheDocument();
    expect(within(sheet()).getByText("Choose time.")).toBeInTheDocument();
    expect(client.book).not.toHaveBeenCalled();
    await findRohan();
    await waitFor(() => expect(within(sheet()).queryByText("Choose patient.")).not.toBeInTheDocument());
  });

  it("asks for a doctor and a type while none has been read yet", () => {
    doctors.current = undefined;
    types.current = undefined;
    draw();
    expect(within(sheet()).getByRole("combobox", { name: /^Doctor/ })).toHaveTextContent("Choose a doctor");
    expect(within(sheet()).getByRole("combobox", { name: /^Type/ })).toHaveTextContent("Choose a type");
    expect(within(sheet()).queryByRole("radio", { checked: true })).not.toBeInTheDocument();
  });

  it("opens the hours on the hour it is now for today, and on the morning for another day (D146)", async () => {
    draw();
    const hour = within(sheet()).getByRole("combobox", { name: "Time, Hour" });
    const active = () => document.getElementById(hour.getAttribute("aria-activedescendant") ?? "");
    await userEvent.click(hour);
    expect(active()).toHaveTextContent("2 PM");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(sheet()).getByRole("button", { name: /^Date/ }));
    await userEvent.click(screen.getByRole("button", { name: "Monday, 12 Oct 2026" }));
    await userEvent.click(hour);
    expect(active()).toHaveTextContent("9 AM");
  });

  it("takes the length from the type chosen — a chip, or Other with its minutes — and Other from the length it leaves (D151)", async () => {
    draw();
    expect(screen.queryByRole("option", { name: "Old" })).not.toBeInTheDocument();
    await choose(/^Type/, "Review");
    expect(within(sheet()).getByRole("radio", { name: "Other" })).toBeChecked();
    expect(within(sheet()).getByRole("textbox", { name: /^Minutes/ })).toHaveValue("25");

    await choose(/^Type/, "Consultation");
    expect(within(sheet()).getByRole("radio", { name: "15 min" })).toBeChecked();
    expect(within(sheet()).queryByRole("textbox", { name: /^Minutes/ })).not.toBeInTheDocument();
    await userEvent.click(within(sheet()).getByRole("radio", { name: "30 min" }));
    await userEvent.click(within(sheet()).getByRole("radio", { name: "Other" }));
    expect(within(sheet()).getByRole("textbox", { name: /^Minutes/ })).toHaveValue("30");
  });

  it("adds a new patient with the booking, under their own key, from what was searched (D145)", async () => {
    search.current = { items: [], nextCursor: null };
    draw();
    await userEvent.type(within(sheet()).getByRole("searchbox"), "Meera Pillai");
    await userEvent.click(within(sheet()).getByRole("button", { name: "New patient" }));
    const added = within(sheet()).getByRole("region", { name: "New patient" });
    expect(within(added).getByRole("textbox", { name: /^Full name/ })).toHaveValue("Meera Pillai");
    await userEvent.type(within(added).getByRole("textbox", { name: /^Mobile/ }), "9876543210");
    await userEvent.click(within(added).getByRole("radio", { name: "Age" }));
    await userEvent.type(within(added).getByRole("textbox", { name: /^Age in years/ }), "34");
    await userEvent.click(within(added).getByRole("radio", { name: "Female" }));
    await choose("Time, Hour", "5 PM");
    await choose("Time, Minutes", ":00");
    await book();

    await waitFor(() => expect(client.book).toHaveBeenCalled());
    expect(sentInput()).toMatchObject({
      patient: {
        mode: "NEW",
        fullName: "Meera Pillai",
        phone: "9876543210",
        born: { as: "AGE", years: "34" },
        gender: "FEMALE",
      },
      patientKey: expect.stringMatching(UUID),
    });
    expect(screen.getByRole("status")).toHaveTextContent(/^Booked Meera Pillai · 11 Oct, 5:00 PM with Rahul Nair$/);
  });

  it("says, in place, what a new patient still needs", async () => {
    draw();
    await userEvent.click(within(sheet()).getByRole("button", { name: "New patient" }));
    await choose("Time, Hour", "5 PM");
    await choose("Time, Minutes", ":00");
    await book();
    expect(await within(sheet()).findByText("Full name needs a value.")).toBeInTheDocument();
    expect(within(sheet()).getByText("Mobile needs a value.")).toBeInTheDocument();
    expect(within(sheet()).getByText("Date of birth needs a value.")).toBeInTheDocument();
    expect(within(sheet()).getByText("Choose gender.")).toBeInTheDocument();
  });

  it("chooses one already on the mobile instead, and goes back to the search", async () => {
    matches.current = [aPatientMatch({ id: ROHAN.id, name: "Rohan Mehta", number: 1012 })];
    draw();
    await userEvent.click(within(sheet()).getByRole("button", { name: "New patient" }));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Rohan Mehta" }));
    expect(within(sheet()).getByRole("button", { name: "Change Rohan Mehta" })).toBeInTheDocument();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Change Rohan Mehta" }));
    await userEvent.click(within(sheet()).getByRole("button", { name: "New patient" }));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Find a patient instead" }));
    expect(within(sheet()).getByRole("searchbox")).toBeInTheDocument();
  });

  it("starts a new patient's mobile from a mobile searched for (D112)", async () => {
    search.current = { items: [], nextCursor: null };
    draw();
    await userEvent.type(within(sheet()).getByRole("searchbox"), "98765 43210");
    await userEvent.click(within(sheet()).getByRole("button", { name: "New patient" }));
    const added = within(sheet()).getByRole("region", { name: "New patient" });
    expect(within(added).getByRole("textbox", { name: /^Mobile/ })).toHaveValue("98765 43210");
    expect(within(added).getByRole("textbox", { name: /^Full name/ })).toHaveValue("");
  });

  it("offers no new patient to a member who may not add one", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "appointments.create"] });
    draw();
    expect(within(sheet()).queryByRole("button", { name: "New patient" })).not.toBeInTheDocument();
  });

  it("names the time taken on the card and at the field, keeps what was typed, and sends it again with the same key (D148)", async () => {
    client.book.mockRejectedValueOnce(
      new ApiError(409, "APPOINTMENT_SLOT_TAKEN", "That time is already booked with this doctor.", "req_1", {
        startsAt: "2026-10-11T10:30:00Z",
        endsAt: "2026-10-11T11:00:00Z",
      }),
    );
    draw();
    await findRohan();
    await choose("Time, Hour", "4 PM");
    await choose("Time, Minutes", ":00");
    await book();

    const card = await screen.findByRole("alertdialog", { name: "Rahul Nair is booked 4:00 PM – 4:30 PM" });
    expect(card).toHaveTextContent("That time is already booked with this doctor.");
    await userEvent.click(within(card).getByRole("button", { name: "Close" }));
    expect(within(sheet()).getAllByText("Rahul Nair is booked 4:00 PM – 4:30 PM")[0]).toBeInTheDocument();
    expect(within(sheet()).getByRole("button", { name: "Change Rohan Mehta" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await book();
    await waitFor(() => expect(client.book).toHaveBeenCalledTimes(2));
    expect(sentKey(1)).toBe(sentKey(0));
  });

  it("names a clinic holiday and a doctor's leave, at the date", async () => {
    client.book
      .mockRejectedValueOnce(
        new ApiError(422, "APPOINTMENT_ON_CLOSED_DAY", "Closed.", "req_1", { reason: "Diwali", wholeClinic: true }),
      )
      .mockRejectedValueOnce(
        new ApiError(422, "APPOINTMENT_ON_CLOSED_DAY", "Closed.", "req_2", {
          reason: "Conference",
          wholeClinic: false,
        }),
      );
    draw();
    await findRohan();
    await choose("Time, Hour", "4 PM");
    await choose("Time, Minutes", ":00");
    await book();
    const holiday = await screen.findByRole("alertdialog", { name: "The clinic is closed that day: Diwali" });
    await userEvent.click(within(holiday).getByRole("button", { name: "Close" }));
    expect(within(sheet()).getByText("The clinic is closed that day: Diwali")).toBeInTheDocument();
    await book();
    expect(
      await screen.findByRole("alertdialog", { name: "Rahul Nair is away that day: Conference" }),
    ).toBeInTheDocument();
  });

  it("goes on with a new patient found once the booking that added them is refused (D145)", async () => {
    client.book.mockRejectedValueOnce(
      new ApiError(409, "APPOINTMENT_SLOT_TAKEN", "Taken.", "req_1", {
        startsAt: "2026-10-11T10:30:00Z",
        endsAt: "2026-10-11T11:00:00Z",
        patient: { ...ROHAN, id: "be528e96-7091-42a3-aedf-4a5b6c7d8e00", name: "Meera Pillai", gender: "FEMALE" },
      }),
    );
    draw();
    await userEvent.click(within(sheet()).getByRole("button", { name: "New patient" }));
    const added = within(sheet()).getByRole("region", { name: "New patient" });
    await userEvent.type(within(added).getByRole("textbox", { name: /^Full name/ }), "Meera Pillai");
    await userEvent.type(within(added).getByRole("textbox", { name: /^Mobile/ }), "9876543210");
    await userEvent.click(within(added).getByRole("radio", { name: "Age" }));
    await userEvent.type(within(added).getByRole("textbox", { name: /^Age in years/ }), "34");
    await userEvent.click(within(added).getByRole("radio", { name: "Female" }));
    await choose("Time, Hour", "4 PM");
    await choose("Time, Minutes", ":00");
    await book();

    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Close" }));
    expect(within(sheet()).getByRole("button", { name: "Change Meera Pillai" })).toBeInTheDocument();
    await choose("Time, Minutes", ":30");
    await book();
    await waitFor(() => expect(client.book).toHaveBeenCalledTimes(2));
    expect(sentInput(1)).toMatchObject({ patient: { mode: "FOUND", id: "be528e96-7091-42a3-aedf-4a5b6c7d8e00" } });
  });

  it("says plainly when the connection failed, naming nothing", async () => {
    client.book.mockRejectedValueOnce(new Error("offline"));
    draw();
    await findRohan();
    await choose("Time, Hour", "4 PM");
    await choose("Time, Minutes", ":00");
    await book();
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t booked" })).toBeInTheDocument();
  });

  it("says plainly when it was not booked for another reason", async () => {
    client.book.mockRejectedValueOnce(new ApiError(422, "PATIENT_ARCHIVED", "This patient is archived.", "req_1"));
    draw();
    await findRohan();
    await choose("Time, Hour", "4 PM");
    await choose("Time, Minutes", ":00");
    await book();
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t booked" })).toHaveTextContent(
      "This patient is archived.",
    );
  });
});

describe("BookingSheet for a patient, and to move an appointment (D161, D166)", () => {
  const moving = anAppointmentDetail({
    patientId: ROHAN.id,
    doctorId: RAHUL.id,
    doctorName: RAHUL.name,
    typeId: CONSULTATION.id,
    scheduledAt: "2026-10-13T03:30:00Z",
    day: "2026-10-13",
    minutes: 30,
    notes: "First visit",
  });
  const onMoved = vi.fn();
  const move = (appointment = moving) =>
    render(
      <Providers>
        <BookingSheet open moving={appointment} onClose={onClose} onMoved={onMoved} />
      </Providers>,
    );
  const moveSheet = () => screen.getByRole("dialog", { name: "Reschedule" });

  beforeEach(() => {
    client.change.mockImplementation(
      async ({ input }: { input: { date: string; time: { hour: string; minute: string } } }) => ({
        id: "a-1",
        doctorId: RAHUL.id,
        status: "SCHEDULED",
        scheduledAt: dayTime(input.date, `${input.time.hour}:${input.time.minute}`),
        minutes: 30,
      }),
    );
  });

  it("opens for the patient of a profile, who stays, the doctor first to fill (D166)", async () => {
    render(
      <Providers>
        <BookingSheet open patient={{ id: ROHAN.id, name: ROHAN.name, number: ROHAN.number }} onClose={onClose} />
      </Providers>,
    );
    const patient = within(sheet()).getByRole("list", { name: "Patient" });
    expect(patient).toHaveTextContent("Rohan MehtaP-1012");
    expect(within(sheet()).queryByRole("searchbox")).not.toBeInTheDocument();
    expect(within(sheet()).queryByRole("button", { name: "New patient" })).not.toBeInTheDocument();
    expect(within(sheet()).getByRole("combobox", { name: /^Doctor/ })).toHaveFocus();

    await choose("Time, Hour", "4 PM");
    await choose("Time, Minutes", ":00");
    await book();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentInput()).toMatchObject({ patient: { mode: "FOUND", id: ROHAN.id } });
    // Held open here, the sheet has the card drawn over it as well as on the page.
    expect(screen.getAllByText("Booked Rohan Mehta · 11 Oct, 4:00 PM with Rahul Nair").length).toBeGreaterThan(0);
  });

  it("starts where the appointment is, and moves it — the patient staying — closing everything with a card", async () => {
    move();
    expect(within(moveSheet()).getByRole("list", { name: "Patient" })).toHaveTextContent("Rohan MehtaP-1012");
    expect(within(moveSheet()).getByRole("combobox", { name: /^Doctor/ })).toHaveTextContent("Rahul Nair");
    expect(within(moveSheet()).getByRole("button", { name: /^Date/ })).toHaveTextContent("13 Oct 2026");
    expect(within(moveSheet()).getByRole("combobox", { name: "Time, Hour" })).toHaveTextContent("9 AM");
    expect(within(moveSheet()).getByRole("radio", { name: "30 min" })).toBeChecked();
    expect(within(moveSheet()).getByRole("textbox", { name: /^Notes/ })).toHaveValue("First visit");

    await userEvent.click(within(moveSheet()).getByRole("combobox", { name: "Time, Hour" }));
    await userEvent.click(screen.getByRole("option", { name: "10 AM" }));
    await userEvent.click(within(moveSheet()).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onMoved).toHaveBeenCalled());
    expect(client.change).toHaveBeenCalledWith({
      id: "a-1",
      input: {
        doctorId: RAHUL.id,
        date: "2026-10-13",
        time: { hour: "10", minute: "00" },
        typeId: CONSULTATION.id,
        length: { choice: "30", other: "" },
        notes: "First visit",
        was: "2026-10-13T03:30:00Z",
      },
    });
    expect(client.book).not.toHaveBeenCalled();
    expect(screen.getAllByText("Moved Rohan Mehta · 13 Oct, 10:00 AM with Rahul Nair").length).toBeGreaterThan(0);
  });

  it("keeps a passed time where it is, and the archived type it is on", async () => {
    move(
      anAppointmentDetail({
        ...moving,
        typeId: OLD.id,
        typeName: OLD.name,
        scheduledAt: "2026-10-10T03:30:00Z",
        day: "2026-10-10",
        notes: null,
      }),
    );
    expect(within(moveSheet()).getByRole("combobox", { name: /^Type/ })).toHaveTextContent("Old");
    expect(within(moveSheet()).getByRole("textbox", { name: /^Notes/ })).toHaveValue("");
    await userEvent.click(within(moveSheet()).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.change).toHaveBeenCalled());
    expect(within(moveSheet()).queryByText(/already passed/)).not.toBeInTheDocument();
  });

  it("names a time taken when moved, and says plainly when it was not moved for another reason", async () => {
    client.change
      .mockRejectedValueOnce(
        new ApiError(409, "APPOINTMENT_SLOT_TAKEN", "Taken.", "req_1", {
          startsAt: "2026-10-13T04:30:00Z",
          endsAt: "2026-10-13T05:00:00Z",
        }),
      )
      .mockRejectedValueOnce(new ApiError(422, "APPOINTMENT_NOT_MOVABLE", "Only a booking can be moved.", "req_2"));
    move();
    await userEvent.click(within(moveSheet()).getByRole("button", { name: "Save" }));
    const taken = await screen.findByRole("alertdialog", { name: "Rahul Nair is booked 10:00 AM – 10:30 AM" });
    await userEvent.click(within(taken).getByRole("button", { name: "Close" }));
    await userEvent.click(within(moveSheet()).getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t changed" })).toHaveTextContent(
      "Only a booking can be moved.",
    );
    expect(onMoved).not.toHaveBeenCalled();
  });
});
