import { describe, expect, it } from "vitest";

import { kindOf, reminderText, sayAppointment, timeOf } from "@/features/appointments/describe";
import { aCalendarAppointment } from "@tests/support/appointments";

describe("describing an appointment", () => {
  it("names its kind: its type, or a walk-in with its token", () => {
    expect(kindOf(aCalendarAppointment())).toBe("Consultation");
    expect(kindOf(aCalendarAppointment({ source: "WALK_IN", token: 7 }))).toBe("Walk-in #7");
    expect(kindOf(aCalendarAppointment({ source: "WALK_IN", token: null }))).toBe("Walk-in");
  });

  it("says when it is, start to end, and the whole of it for a screen reader", () => {
    const appointment = aCalendarAppointment({ scheduledAt: "2026-10-13T04:30:00Z", minutes: 30 });
    expect(timeOf(appointment)).toBe("10:00 AM – 10:30 AM");
    expect(sayAppointment(appointment)).toBe("10:00 AM – 10:30 AM, Rohan Mehta, Consultation, Scheduled");
  });
});

describe("reminderText (plan §22.1, D179)", () => {
  it("writes the reminder the patient reads: the doctor, the clinic, the day and time", () => {
    expect(reminderText(aCalendarAppointment(), "Smile Care")).toBe(
      "Reminder: your appointment with Dr. Maya Rao at Smile Care on Tue 13 Oct, 9:00 AM.",
    );
  });

  it("calls a doctor Dr. once, and leaves out one gone from the team", () => {
    expect(reminderText(aCalendarAppointment({ doctorName: "Dr. Maya Rao" }), "Smile Care")).toContain(
      "with Dr. Maya Rao at",
    );
    expect(reminderText(aCalendarAppointment({ doctorName: null }), "Smile Care")).toBe(
      "Reminder: your appointment at Smile Care on Tue 13 Oct, 9:00 AM.",
    );
  });
});
