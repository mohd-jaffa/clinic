import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  appointmentChangeSchema,
  appointmentNotesSchema,
  bookedTimesSchema,
  bookingSchema,
  calendarQuerySchema,
  CANCEL_REASONS,
  cancelSchema,
  HOURS,
  MINUTES,
  OTHER_REASON,
  queueQuerySchema,
  rescheduleSchema,
  statusChangeSchema,
  walkInSchema,
  type BookingInput,
  type RescheduleInput,
} from "@/lib/validation";

const PATIENT = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const DOCTOR = "8c2f5b63-4d6e-4f70-9bac-1d2e3f4a5b6c";
const TYPE = "9d306c74-5e7f-4081-8cbd-2e3f4a5b6c7d";

const booking = (overrides: Partial<BookingInput> = {}): BookingInput => ({
  patient: { mode: "FOUND", id: PATIENT },
  doctorId: DOCTOR,
  date: "2026-10-13",
  time: { hour: "10", minute: "30" },
  typeId: TYPE,
  length: { choice: "15", other: "" },
  notes: "",
  ...overrides,
});

/** Each refusal's path and words. */
const refusals = (input: unknown) => {
  const result = bookingSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => [issue.path.join("."), issue.message]);
};

// Now, in Kochi: 11 October 2026, 2:00 PM.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T08:30:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("bookingSchema (D144 – D151)", () => {
  it("reads a patient found, the day and time as one instant on the clinic's clock, and the chip's length", () => {
    expect(bookingSchema.parse(booking({ notes: "  Bring the X-ray " }))).toEqual({
      patient: { mode: "FOUND", id: PATIENT },
      doctorId: DOCTOR,
      typeId: TYPE,
      scheduledAt: "2026-10-13T05:00:00.000Z",
      minutes: 15,
      notes: "Bring the X-ray",
    });
  });

  it("reads a new patient as a patient is added, with their own key beside the booking", () => {
    const key = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
    const parsed = bookingSchema.parse(
      booking({
        patient: {
          mode: "NEW",
          id: "",
          fullName: " Meera  Pillai ",
          phone: "98765 43210",
          born: { as: "AGE", years: "34" },
          gender: "FEMALE",
        },
        patientKey: key,
      }),
    );
    expect(parsed.patient).toEqual({
      mode: "NEW",
      fullName: "Meera Pillai",
      phone: "+919876543210",
      born: { dateOfBirth: "1992-10-11", dobIsEstimated: true },
      gender: "FEMALE",
    });
    expect(parsed.patientKey).toBe(key);
  });

  it("says, in place, what a new patient still needs", () => {
    expect(
      refusals(
        booking({ patient: { mode: "NEW", fullName: "", phone: "123", born: { as: "DATE", date: "" }, gender: "" } }),
      ),
    ).toEqual([
      ["patient.fullName", "Full name needs a value."],
      ["patient.phone", "Enter a valid 10-digit mobile number."],
      ["patient.born.date", "Date of birth needs a value."],
      ["patient.gender", "Choose gender."],
    ]);
  });

  it("asks for a patient, a doctor and a type while none is chosen", () => {
    expect(refusals(booking({ patient: { mode: "FOUND", id: "" }, doctorId: "", typeId: "" }))).toEqual([
      ["patient.id", "Choose patient."],
      ["doctorId", "Choose doctor."],
      ["typeId", "Choose type."],
    ]);
  });

  it("asks for both halves of the time, on the clinic's steps", () => {
    expect(refusals(booking({ time: { hour: "10", minute: "" } }))).toEqual([["time", "Choose time."]]);
    expect(refusals(booking({ time: { hour: "10", minute: "07" } }))).toEqual([["time", "Choose time."]]);
    expect(HOURS).toHaveLength(24);
    expect(MINUTES).toEqual(["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"]);
  });

  it("refuses a day before today, and a time already passed — the current step still open", () => {
    expect(refusals(booking({ date: "2026-10-10" }))).toEqual([["date", "Date can’t be before today."]]);
    expect(refusals(booking({ date: "2026-10-11", time: { hour: "13", minute: "55" } }))).toEqual([
      ["time", "That time has already passed. Choose a later time, or add a walk-in."],
    ]);
    expect(refusals(booking({ date: "2026-10-11", time: { hour: "14", minute: "00" } }))).toEqual([]);
  });

  it("takes Other's minutes within the bounds, and says what is wrong with them", () => {
    expect(bookingSchema.parse(booking({ length: { choice: "OTHER", other: "25" } })).minutes).toBe(25);
    expect(refusals(booking({ length: { choice: "OTHER", other: "" } }))).toEqual([
      ["length.other", "Minutes needs a value."],
    ]);
    expect(refusals(booking({ length: { choice: "OTHER", other: "600" } }))).toEqual([
      ["length.other", "Minutes must be from 5 to 480."],
    ]);
    expect(refusals(booking({ length: { choice: "12", other: "30" } }))).toEqual([
      ["length.other", "That value is not valid."],
    ]);
  });

  it("refuses what is not a booking at all", () => {
    expect(bookingSchema.safeParse({ ...booking(), patient: "x", time: "10:30", length: 15 }).success).toBe(false);
  });
});

describe("bookedTimesSchema (D147)", () => {
  it("takes a doctor and a day", () => {
    expect(bookedTimesSchema.parse({ doctorId: DOCTOR, date: "2026-10-13" })).toEqual({
      doctorId: DOCTOR,
      date: "2026-10-13",
    });
    expect(bookedTimesSchema.safeParse({ doctorId: "x", date: "2026-10-13" }).success).toBe(false);
  });
});

describe("calendarQuerySchema (plan §11.5)", () => {
  it("takes a day or a week, one doctor's or every doctor's", () => {
    expect(calendarQuerySchema.parse({ from: "2026-10-13", to: "2026-10-13" })).toEqual({
      from: "2026-10-13",
      to: "2026-10-13",
    });
    expect(calendarQuerySchema.parse({ from: "2026-10-12", to: "2026-10-18", doctorId: DOCTOR })).toMatchObject({
      doctorId: DOCTOR,
    });
  });

  it("refuses days that run backwards or past a week", () => {
    expect(calendarQuerySchema.safeParse({ from: "2026-10-13", to: "2026-10-12" }).success).toBe(false);
    expect(calendarQuerySchema.safeParse({ from: "2026-10-12", to: "2026-10-19" }).success).toBe(false);
    expect(calendarQuerySchema.safeParse({ from: "2026-10-12", to: "2026-10-13", doctorId: "x" }).success).toBe(false);
  });
});

describe("rescheduleSchema (D161)", () => {
  const move = (overrides: Partial<RescheduleInput> = {}): RescheduleInput => ({
    doctorId: DOCTOR,
    date: "2026-10-13",
    time: { hour: "11", minute: "00" },
    typeId: TYPE,
    length: { choice: "30", other: "" },
    notes: "  Moved by phone ",
    ...overrides,
  });
  const issues = (input: unknown) => {
    const result = rescheduleSchema.safeParse(input);
    return result.success ? [] : result.error.issues.map((issue) => [issue.path.join("."), issue.message]);
  };

  it("reads where it goes — its doctor, time, type, length and notes — the patient staying", () => {
    expect(rescheduleSchema.parse({ ...move(), patient: { mode: "FOUND", id: PATIENT } })).toEqual({
      doctorId: DOCTOR,
      typeId: TYPE,
      notes: "Moved by phone",
      scheduledAt: "2026-10-13T05:30:00.000Z",
      minutes: 30,
    });
  });

  it("refuses a day passed or a time passed, unless it is where the appointment already is", () => {
    expect(issues(move({ date: "2026-10-10" }))).toEqual([["date", "Date can’t be before today."]]);
    const earlier = move({ date: "2026-10-11", time: { hour: "09", minute: "00" } });
    expect(issues(earlier)).toEqual([["time", "That time has already passed. Choose a later time, or add a walk-in."]]);
    expect(issues({ ...earlier, was: "2026-10-11T03:30:00+00:00" })).toEqual([]);
    expect(issues({ ...earlier, was: "2026-10-11T03:00:00Z" })).toHaveLength(1);
    expect(issues({ ...move(), was: "yesterday" })).toEqual([["was", "That value is not valid."]]);
  });
});

describe("appointmentChangeSchema (D161)", () => {
  it("takes notes alone, or the appointment moved", () => {
    expect(appointmentNotesSchema.parse({ notes: " Bring reports " })).toEqual({ notes: "Bring reports" });
    expect(appointmentChangeSchema.parse({ notes: "" })).toEqual({ notes: null });
    expect(
      appointmentChangeSchema.parse({
        doctorId: DOCTOR,
        date: "2026-10-13",
        time: { hour: "11", minute: "00" },
        typeId: TYPE,
        length: { choice: "15", other: "" },
        notes: "",
      }),
    ).toMatchObject({ doctorId: DOCTOR, minutes: 15 });
  });

  it("refuses a move half sent, rather than reading it as notes", () => {
    const result = appointmentChangeSchema.safeParse({ notes: "x", doctorId: DOCTOR });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("That value is not valid.");
  });
});

describe("statusChangeSchema (plan §11.2, D162)", () => {
  it("takes the statuses the detail sets, a cancellation with its reason", () => {
    expect(statusChangeSchema.parse({ status: "CONFIRMED" })).toEqual({ status: "CONFIRMED", reason: null });
    expect(statusChangeSchema.parse({ status: "CANCELLED", reason: " Patient asked " })).toEqual({
      status: "CANCELLED",
      reason: "Patient asked",
    });
  });

  it("refuses a cancellation without a reason, and a status the detail does not set", () => {
    const bare = statusChangeSchema.safeParse({ status: "CANCELLED", reason: "  " });
    expect(bare.error?.issues.map((issue) => [issue.path.join("."), issue.message])).toEqual([
      ["reason", "Reason needs a value."],
    ]);
    expect(statusChangeSchema.safeParse({ status: "COMPLETED" }).error?.issues[0].message).toBe(
      "That value is not valid.",
    );
  });
});

describe("cancelSchema (D162)", () => {
  it("reads a quick reason as itself, and Other as what was typed", () => {
    expect(cancelSchema.parse({ choice: CANCEL_REASONS[0], other: "" })).toEqual({ reason: "Patient asked" });
    expect(cancelSchema.parse({ choice: OTHER_REASON, other: " Moved away  " })).toEqual({ reason: "Moved away" });
  });

  it("asks for a reason, and Other's to be typed", () => {
    const none = cancelSchema.safeParse({ choice: "", other: "" });
    expect(none.error?.issues.map((issue) => [issue.path.join("."), issue.message])).toEqual([
      ["choice", "Choose why."],
    ]);
    const blank = cancelSchema.safeParse({ choice: OTHER_REASON, other: " " });
    expect(blank.error?.issues.map((issue) => [issue.path.join("."), issue.message])).toEqual([
      ["other", "Reason needs a value."],
    ]);
    expect(cancelSchema.safeParse(null).error?.issues[0].message).toBe("That value is not valid.");
  });
});

describe("walkInSchema (plan §11.3, D171)", () => {
  it("reads the patient — found, or new — the doctor and the type", () => {
    expect(walkInSchema.parse({ patient: { mode: "FOUND", id: PATIENT }, doctorId: DOCTOR, typeId: TYPE })).toEqual({
      patient: { mode: "FOUND", id: PATIENT },
      doctorId: DOCTOR,
      typeId: TYPE,
    });
    const added = walkInSchema.parse({
      patient: {
        mode: "NEW",
        fullName: " Meera  Pillai ",
        phone: "98765 43210",
        born: { as: "AGE", years: "34" },
        gender: "FEMALE",
      },
      doctorId: DOCTOR,
      typeId: TYPE,
      patientKey: PATIENT,
    });
    expect(added.patient).toMatchObject({ mode: "NEW", fullName: "Meera Pillai", phone: "+919876543210" });
  });

  it("asks for the patient, the doctor and the type", () => {
    const result = walkInSchema.safeParse({ patient: { mode: "FOUND", id: "" }, doctorId: "", typeId: "" });
    expect(result.error?.issues.map((issue) => [issue.path.join("."), issue.message])).toEqual([
      ["patient.id", "Choose patient."],
      ["doctorId", "Choose doctor."],
      ["typeId", "Choose type."],
    ]);
  });
});

describe("queueQuerySchema (plan §11.4)", () => {
  it("reads one doctor, or every doctor while none is named", () => {
    expect(queueQuerySchema.parse({})).toEqual({});
    expect(queueQuerySchema.parse({ doctorId: DOCTOR })).toEqual({ doctorId: DOCTOR });
    expect(queueQuerySchema.safeParse({ doctorId: "x" }).error?.issues[0].message).toBe("That value is not valid.");
  });
});
