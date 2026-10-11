import * as z from "zod";

import { APPOINTMENT_MINUTES, APPOINTMENT_STEP_MINUTES, MAX_CALENDAR_DAYS, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { APPOINTMENT_STATUS_CHANGES } from "@/constants/statuses";
import { dayCount, dayTime, todayKey } from "@/lib/dates/calendar";

import { optionalLine, optionalLines, requiredDay, requiredLine, wholeNumberText } from "../primitives";
import { newPatientSchema } from "./patients";

const { appointments, appointment } = UI_TEXT;

/** How the patient is given (D144, D145): one found by the search, or a new one added with the booking. */
export const PATIENT_MODES = ["FOUND", "NEW"] as const;
export type PatientMode = (typeof PATIENT_MODES)[number];

/** The lengths offered as chips (D151), in minutes; **Other** takes any length within APPOINTMENT_MINUTES. */
export const LENGTH_CHOICES = ["10", "15", "20", "30", "45", "60"] as const;
export const OTHER_LENGTH = "OTHER";

/** The hours of the day a booking may start in, and the minutes of the hour on the clinic's steps (D146). */
export const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
export const MINUTES = Array.from({ length: 60 / APPOINTMENT_STEP_MINUTES }, (_, step) =>
  String(step * APPOINTMENT_STEP_MINUTES).padStart(2, "0"),
);

/** One of a list the form starts with none of — a doctor, a type — refused in words while none is chosen. */
const chosenId = (label: string) =>
  z.union([z.uuid(), z.literal("")], { error: VALIDATION_MESSAGES.choose(label) }).transform((id, ctx) => {
    if (id !== "") return id;
    ctx.addIssue({ code: "custom", message: VALIDATION_MESSAGES.choose(label) });
    return z.NEVER;
  });

/**
 * The patient (D144, D145): one found by the search — their id — or a new one
 * added with the booking, as `newPatientSchema` reads them. The sheet holds
 * both sets of fields at once and only the chosen one is read.
 */
const patient = z
  .object(
    {
      mode: z.enum(PATIENT_MODES),
      id: z.string().optional(),
      fullName: z.string().optional(),
      phone: z.string().optional(),
      born: z.object({ as: z.string(), date: z.string().optional(), years: z.string().optional() }).optional(),
      gender: z.string().optional(),
    },
    { error: VALIDATION_MESSAGES.invalid },
  )
  .transform(({ mode, id, ...fields }, ctx) => {
    if (mode === "FOUND") {
      const found = z.uuid().safeParse(id);
      if (found.success) return { mode, id: found.data };
      ctx.addIssue({ code: "custom", path: ["id"], message: VALIDATION_MESSAGES.choose(appointments.patientLabel) });
      return z.NEVER;
    }
    const added = newPatientSchema.safeParse(fields);
    if (added.success) return { mode, ...added.data };
    for (const issue of added.error.issues) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
    return z.NEVER;
  });

/** The time of day, its hour and its minutes chosen apart (D146): "10:30", or refused while either is missing. */
const time = z
  .object({ hour: z.string(), minute: z.string() }, { error: VALIDATION_MESSAGES.choose(appointments.timeLabel) })
  .transform(({ hour, minute }, ctx) => {
    if (HOURS.includes(hour) && MINUTES.includes(minute)) return `${hour}:${minute}`;
    ctx.addIssue({ code: "custom", message: VALIDATION_MESSAGES.choose(appointments.timeLabel) });
    return z.NEVER;
  });

/** Its length (D151): a chip's minutes, or Other's, within APPOINTMENT_MINUTES. */
const length = z
  .object({ choice: z.string(), other: z.string() }, { error: VALIDATION_MESSAGES.invalid })
  .transform(({ choice, other }, ctx) => {
    if ((LENGTH_CHOICES as readonly string[]).includes(choice)) return Number(choice);
    const minutes = wholeNumberText(appointments.minutesLabel, APPOINTMENT_MINUTES).safeParse(other);
    if (choice === OTHER_LENGTH && minutes.success) return minutes.data;
    ctx.addIssue({
      code: "custom",
      path: ["other"],
      message: minutes.success ? VALIDATION_MESSAGES.invalid : minutes.error.issues[0].message,
    });
    return z.NEVER;
  });

/** Refuses a day before today, or a time already passed on the clinic's 5-minute steps. */
function refusePast(date: string, at: string, ctx: z.RefinementCtx) {
  if (date < todayKey()) {
    ctx.addIssue({
      code: "custom",
      path: ["date"],
      message: VALIDATION_MESSAGES.notBeforeToday(appointments.dateLabel),
    });
    return;
  }
  const step = APPOINTMENT_STEP_MINUTES * 60_000;
  if (Date.parse(dayTime(date, at)) < Math.floor(Date.now() / step) * step) {
    ctx.addIssue({ code: "custom", path: ["time"], message: appointments.timePassed });
  }
}

/**
 * A booking (plan §11.1; D144 – D151): the patient — found, or added with it —
 * the doctor, the day, the time on the clinic's steps, the type and its
 * length, and notes. A time already passed is refused here for the sheet,
 * and again by `create_appointment`, against the database's own clock.
 * `patientKey` is the new patient's own idempotency key, sent beside the
 * booking's, so a booking sent again after a clash adds them once.
 */
export const bookingSchema = z
  .object({
    patient,
    doctorId: chosenId(appointments.doctorLabel),
    date: requiredDay(appointments.dateLabel),
    time,
    typeId: chosenId(appointments.typeLabel),
    length,
    notes: optionalLines(appointments.notesLabel, TEXT_LIMITS.notes),
    patientKey: z.uuid().optional(),
  })
  .superRefine(({ date, time: at }, ctx) => refusePast(date, at, ctx))
  .transform(({ date, time: at, length: minutes, ...booking }) => ({
    ...booking,
    scheduledAt: dayTime(date, at),
    minutes,
  }));

export type BookingInput = z.input<typeof bookingSchema>;
export type BookingPayload = z.output<typeof bookingSchema>;

/**
 * An appointment moved (plan §11.1, D161): the booking sheet's fields without
 * the patient, who stays. `was` is when it is now: kept there, a time already
 * passed is not refused — only its notes may be changing — while a new time
 * is refused in the past here and by `update_appointment`.
 */
export const rescheduleSchema = z
  .object({
    doctorId: chosenId(appointments.doctorLabel),
    date: requiredDay(appointments.dateLabel),
    time,
    typeId: chosenId(appointments.typeLabel),
    length,
    notes: optionalLines(appointments.notesLabel, TEXT_LIMITS.notes),
    was: z.iso.datetime({ offset: true, error: VALIDATION_MESSAGES.invalid }).optional(),
  })
  .superRefine(({ date, time: at, was }, ctx) => {
    if (was === undefined || Date.parse(dayTime(date, at)) !== Date.parse(was)) refusePast(date, at, ctx);
  })
  .transform(({ doctorId, typeId, notes, date, time: at, length: minutes }) => ({
    doctorId,
    typeId,
    notes,
    scheduledAt: dayTime(date, at),
    minutes,
  }));

export type RescheduleInput = z.input<typeof rescheduleSchema>;
export type ReschedulePayload = z.output<typeof rescheduleSchema>;

/** An appointment's notes alone (D161): changed at any time, whatever its status (plan §11.1). */
export const appointmentNotesSchema = z.strictObject(
  { notes: optionalLines(appointments.notesLabel, TEXT_LIMITS.notes) },
  { error: VALIDATION_MESSAGES.invalid },
);

export type AppointmentNotesInput = z.input<typeof appointmentNotesSchema>;

/** What `PATCH /api/appointments/[id]` takes: its notes alone, or the appointment moved. */
export const appointmentChangeSchema = z.union([appointmentNotesSchema, rescheduleSchema], {
  error: VALIDATION_MESSAGES.invalid,
});

export type AppointmentChangeInput = z.input<typeof appointmentChangeSchema>;
export type AppointmentChangePayload = z.output<typeof appointmentChangeSchema>;

/**
 * A status set from the detail (plan §11.2): confirmed, back to scheduled, a
 * no-show, or cancelled — which takes its reason (D162).
 */
export const statusChangeSchema = z
  .object({
    status: z.enum(APPOINTMENT_STATUS_CHANGES, { error: VALIDATION_MESSAGES.invalid }),
    reason: optionalLine(appointment.reasonLabel, TEXT_LIMITS.reason),
  })
  .superRefine(({ status, reason }, ctx) => {
    if (status === "CANCELLED" && reason === null) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: VALIDATION_MESSAGES.required(appointment.reasonLabel),
      });
    }
  });

export type StatusChangeInput = z.input<typeof statusChangeSchema>;
export type StatusChangePayload = z.output<typeof statusChangeSchema>;

/** The quick reasons a cancellation is given by (D162); **Other** takes one typed. */
export const CANCEL_REASONS = appointment.reasons;
export const OTHER_REASON = "OTHER";

/** Why it is cancelled (D162): a quick reason chosen, or Other's, typed — as the line it is saved as. */
export const cancelSchema = z
  .object({ choice: z.string(), other: z.string() }, { error: VALIDATION_MESSAGES.invalid })
  .transform(({ choice, other }, ctx) => {
    if ((CANCEL_REASONS as readonly string[]).includes(choice)) return { reason: choice };
    if (choice !== OTHER_REASON) {
      ctx.addIssue({ code: "custom", path: ["choice"], message: VALIDATION_MESSAGES.choose(appointment.reasonsLabel) });
      return z.NEVER;
    }
    const typed = requiredLine(appointment.reasonLabel, { max: TEXT_LIMITS.reason }).safeParse(other);
    if (typed.success) return { reason: typed.data };
    ctx.addIssue({ code: "custom", path: ["other"], message: typed.error.issues[0].message });
    return z.NEVER;
  });

export type CancelInput = z.input<typeof cancelSchema>;

/** A doctor's day, for their booked times (D147): who and which day, never a patient — so in the address. */
export const bookedTimesSchema = z.object({
  doctorId: z.uuid({ error: VALIDATION_MESSAGES.invalid }),
  date: requiredDay(appointments.dateLabel),
});

export type BookedTimesPayload = z.output<typeof bookedTimesSchema>;

/**
 * The calendar's days (plan §11.5): from one day to another — a day, or the
 * week (D158), at most MAX_CALENDAR_DAYS — and one doctor's, or every
 * doctor's while none is named. Days and a doctor, never a patient, so in the
 * address.
 */
export const calendarQuerySchema = z
  .object({
    from: requiredDay(appointments.dateLabel),
    to: requiredDay(appointments.dateLabel),
    doctorId: z.uuid({ error: VALIDATION_MESSAGES.invalid }).optional(),
  })
  .superRefine(({ from, to }, ctx) => {
    if (to < from || dayCount(from, to) > MAX_CALENDAR_DAYS) {
      ctx.addIssue({ code: "custom", path: ["to"], message: VALIDATION_MESSAGES.atMostDays(MAX_CALENDAR_DAYS) });
    }
  });

export type CalendarQuery = z.output<typeof calendarQuerySchema>;
