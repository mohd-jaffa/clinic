"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, CalendarPlus } from "lucide-react";
import { useRef, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";

import { ChoiceField } from "@/components/ui/choice-field";
import { ClockField } from "@/components/ui/clock-field";
import { DateField } from "@/components/ui/date-field";
import { FormSheet } from "@/components/ui/form-sheet";
import { useResponse } from "@/components/ui/response-card";
import { SelectField } from "@/components/ui/select-field";
import { TextAreaField, TextField } from "@/components/ui/text-field";
import { FIRST_HOUR_SHOWN, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAppointmentTypes } from "@/features/clinic/hooks/useAppointmentTypes";
import type { AppointmentType } from "@/features/clinic/types";
import { useDoctors } from "@/features/team/hooks/useDoctors";
import { ApiError } from "@/lib/api/client";
import { requestKeys } from "@/lib/api/request-key";
import { clinicHour, dayKey, minutesOfDay, todayKey } from "@/lib/dates/calendar";
import { formatDayMonth, formatTime } from "@/lib/format/date";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { useRevalidate } from "@/lib/query/useRevalidate";
import {
  bookingSchema,
  FORM_RESET_OPTIONS,
  HOURS,
  LENGTH_CHOICES,
  MINUTES,
  OTHER_LENGTH,
  rescheduleSchema,
} from "@/lib/validation";

import { AppointmentsClient } from "../api.client";
import { NO_PATIENT, refusalOf, type AppointmentForm } from "../form";
import { usePatientChoice } from "../hooks/usePatientChoice";
import { appointmentRoutes } from "../keys";
import type { AppointmentDetail } from "../types";
import { DoctorDay } from "./DoctorDay";
import { PatientField, type FixedPatient } from "./PatientField";

const { appointments, appointment: moves } = UI_TEXT;
const LENGTH_OPTIONS = [
  ...LENGTH_CHOICES.map((minutes) => ({ value: minutes, label: appointments.minutes(Number(minutes)) })),
  { value: OTHER_LENGTH, label: appointments.otherLength },
];

/** A type's own length as the chips hold it (D151): its chip, or Other with its minutes. */
function lengthOf(minutes: number): AppointmentForm["length"] {
  const chip = LENGTH_CHOICES.find((choice) => Number(choice) === minutes);
  return chip ? { choice: chip, other: "" } : { choice: OTHER_LENGTH, other: String(minutes) };
}

/** What a tap on the calendar's grid starts a booking with (D156): its doctor, its day and its time. */
export type BookingPrefill = Pick<AppointmentForm, "doctorId" | "date" | "time">;

/** What the sheet starts with (D149): today, the doctor, the clinic's first type and its length; no time. */
const blank = (doctorId: string, type: AppointmentType | undefined, patientId = ""): AppointmentForm => ({
  patient: { ...structuredClone(NO_PATIENT), id: patientId },
  doctorId,
  date: todayKey(),
  time: { hour: "", minute: "" },
  typeId: type?.id ?? "",
  length: type ? lengthOf(type.minutes) : { choice: "", other: "" },
  notes: "",
});

/** An appointment being moved, as the sheet starts (D161): where it is now — its doctor, day, time, type, length, notes. */
function startsAs(moving: AppointmentDetail): AppointmentForm {
  const minutes = minutesOfDay(moving.scheduledAt);
  return {
    patient: { ...structuredClone(NO_PATIENT), id: moving.patientId },
    doctorId: moving.doctorId,
    date: moving.day,
    time: {
      hour: String(Math.floor(minutes / 60)).padStart(2, "0"),
      minute: String(minutes % 60).padStart(2, "0"),
    },
    typeId: moving.typeId,
    length: lengthOf(moving.minutes),
    notes: moving.notes ?? "",
    was: moving.scheduledAt,
  };
}

/**
 * Booking an appointment (plan §11.1; D144 – D151). The patient is searched
 * for in the sheet, or added with the booking — name, mobile, date of birth
 * or age, gender, with "Already here?" to choose one already on the mobile.
 * Then the doctor, the day, the time in two halves with what the doctor
 * already has that day under it, the type, which fills its length, and
 * notes. It starts on today, the doctor booking (or the clinic's only
 * doctor) and the clinic's first type — or, from a tap on the calendar's
 * grid, that doctor, day and time (D156). A booking sent twice books once; a
 * new patient sent again is added once.
 *
 * A time taken, or a closed day, is said on a card naming it, and the sheet
 * keeps what was typed. A new patient added before such a refusal stays
 * added, and the sheet goes on with them found. Booked, it closes, and the
 * card says who, when and with whom.
 *
 * From a patient's profile it opens for them (D166). **Reschedule** opens it
 * on an appointment where it is now, its patient staying (D161): moved, it
 * closes with a card, under the same rules.
 */
export function BookingSheet({
  open,
  onClose,
  prefill,
  patient,
  moving,
  onMoved,
}: {
  open: boolean;
  onClose: () => void;
  /** Where a tap on the calendar's grid started it (D156). */
  prefill?: BookingPrefill;
  /** Who it books, from their profile (D166). */
  patient?: FixedPatient;
  /** The appointment it moves (D161). */
  moving?: AppointmentDetail;
  /** Moved: everything it was opened from closes too. */
  onMoved?: () => void;
}) {
  const respond = useResponse();
  const refresh = useRevalidate();
  const { membership } = useAuth();
  const doctors = useDoctors().data ?? [];
  const activeTypes = (useAppointmentTypes().data ?? []).filter((type) => type.active);
  // A type archived since keeps its place in the list of the appointment it is still on.
  const types =
    moving && !activeTypes.some((type) => type.id === moving.typeId)
      ? [...activeTypes, { id: moving.typeId, name: moving.typeName }]
      : activeTypes;
  const ownDoctor = doctors.find((doctor) => doctor.id === membership?.doctorId)?.id;
  const firstDoctor = ownDoctor ?? (doctors.length === 1 ? doctors[0].id : "");
  const fixed: FixedPatient | undefined = moving
    ? { id: moving.patientId, name: moving.patientName, number: moving.patientNumber }
    : patient;
  const canAddPatient = !fixed && membership !== null && hasAccess(membership, "patients.create");

  const [keys] = useState(requestKeys);
  const [patientKeys] = useState(requestKeys);
  const startsWith = () => blank(firstDoctor, activeTypes[0], fixed?.id);
  // With the patient fixed, the doctor is the first thing to fill — not the notes, the first typed field.
  const doctorField = useRef<HTMLButtonElement | null>(null);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitted },
  } = useForm<AppointmentForm>({
    // The form is held as typed; what is sent is read once more by the route.
    resolver: zodResolver(moving ? rescheduleSchema : bookingSchema) as unknown as Resolver<AppointmentForm>,
    defaultValues: moving ? startsAs(moving) : { ...startsWith(), ...prefill },
    resetOptions: FORM_RESET_OPTIONS,
  });
  const [mode, doctorId, date, lengthChoice] = useWatch({
    control,
    name: ["patient.mode", "doctorId", "date", "length.choice"],
  });
  const choice = usePatientChoice(setValue, isSubmitted);
  const doctorName = (id: string) => doctors.find((doctor) => doctor.id === id)?.name ?? "";
  // Who and with whom the booking sent is, for the card that answers it: the form still holds it.
  const sent = () => {
    const { patient: given, doctorId: doctor } = getValues();
    return {
      // A patient found is the one chosen, or the one it was opened for: the form refuses a booking without one.
      patient: given.mode === "NEW" ? given.fullName.trim() : (fixed ?? choice.chosen)!.name,
      doctor: doctorName(doctor),
    };
  };

  const when = (at: string) => appointments.bookedWhen(formatDayMonth(dayKey(at)), formatTime(at));

  /** A booking or a move refused (D145, D148): the time taken, or the closed day, named on the card and the field. */
  const refused = (failure: unknown, fallback: string) => {
    const { doctor } = sent();
    const named = refusalOf(failure);
    // Added before the booking was refused, the patient stays added (D145): go on with them found.
    if (named?.patient) choice.choose(named.patient);
    let title = fallback;
    if (failure instanceof ApiError && failure.code === "APPOINTMENT_SLOT_TAKEN" && named?.startsAt && named.endsAt) {
      title = appointments.slotTaken(
        doctor,
        appointments.timeRange(formatTime(named.startsAt), formatTime(named.endsAt)),
      );
      setError("time", { message: title });
    } else if (failure instanceof ApiError && failure.code === "APPOINTMENT_ON_CLOSED_DAY" && named?.reason) {
      title = named.wholeClinic
        ? appointments.clinicClosed(named.reason)
        : appointments.doctorAway(doctor, named.reason);
      setError("date", { message: title });
    }
    respond.failure(failure, { title });
  };

  const booking = useApiMutation(AppointmentsClient.book, {
    revalidate: [
      apiRoutes.appointments.list,
      apiRoutes.appointments.booked,
      apiRoutes.queue.list,
      apiRoutes.patients.search,
      apiRoutes.patients.matches,
    ],
    onSuccess: (booked) => {
      const { patient: name, doctor } = sent();
      keys.settle();
      patientKeys.settle();
      choice.choose(null);
      reset(startsWith());
      onClose();
      void refresh([apiRoutes.patients.summary(booked.patientId), apiRoutes.patients.timeline(booked.patientId)]);
      respond.success({ title: appointments.booked(name, when(booked.scheduledAt), doctor) });
    },
    onError: (failure) => refused(failure, appointments.notBooked),
  });

  const move = useApiMutation(AppointmentsClient.change, {
    revalidate: moving ? appointmentRoutes(moving) : [],
    onSuccess: (moved) => {
      const { patient: name } = sent();
      onMoved?.();
      respond.success({ title: moves.moved(name, when(moved.scheduledAt), doctorName(moved.doctorId)) });
    },
    onError: (failure) => refused(failure, moves.notChanged),
  });

  const save = () => {
    // A copy: the birth is an object the form goes on changing in place.
    const values = structuredClone(getValues());
    if (moving) {
      // The patient stays: the move sends where it goes.
      const { doctorId: doctor, date: day, time, typeId, length, notes, was } = values;
      void move.submit({ id: moving.id, input: { doctorId: doctor, date: day, time, typeId, length, notes, was } });
      return;
    }
    const input =
      values.patient.mode === "NEW" ? { ...values, patientKey: patientKeys.keyFor(values.patient) } : values;
    void booking.submit({ input, key: keys.keyFor(input) });
  };

  return (
    <FormSheet
      open={open}
      title={moving ? moves.rescheduleTitle : appointments.bookTitle}
      onClose={onClose}
      onSubmit={handleSubmit(save)}
      submitting={booking.submitting || move.submitting}
      submitLabel={moving ? UI_TEXT.actions.save : appointments.book}
      submitIcon={moving ? CalendarClock : CalendarPlus}
      initialFocus={fixed ? doctorField : undefined}
    >
      <PatientField
        control={control}
        register={register}
        errors={errors}
        setValue={setValue}
        mode={mode}
        fixed={fixed}
        canAdd={canAddPatient}
        choice={choice}
      />
      <Controller
        control={control}
        name="doctorId"
        render={({ field }) => (
          <SelectField
            ref={(node) => {
              field.ref(node);
              doctorField.current = node;
            }}
            label={appointments.doctorLabel}
            options={doctors.map(({ id, name }) => ({ value: id, label: name }))}
            placeholder={field.value ? undefined : appointments.chooseDoctor}
            required
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.doctorId?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="date"
        render={({ field }) => (
          <DateField
            ref={field.ref}
            label={appointments.dateLabel}
            required
            min={todayKey()}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.date?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="time"
        render={({ field }) => (
          <ClockField
            ref={field.ref}
            label={appointments.timeLabel}
            hourLabel={appointments.hourLabel}
            minuteLabel={appointments.minuteLabel}
            hours={HOURS}
            minutes={MINUTES}
            opensAt={String(date === todayKey() ? clinicHour() : FIRST_HOUR_SHOWN).padStart(2, "0")}
            required
            value={{ hour: field.value.hour, minute: field.value.minute }}
            onChange={field.onChange}
            error={errors.time?.message}
          />
        )}
      />
      <DoctorDay
        doctorId={doctorId}
        doctorName={doctorName(doctorId)}
        date={date}
        except={moving?.doctorId === doctorId ? moving.scheduledAt : undefined}
      />
      <Controller
        control={control}
        name="typeId"
        render={({ field }) => (
          <SelectField
            ref={field.ref}
            label={appointments.typeLabel}
            options={types.map(({ id, name }) => ({ value: id, label: name }))}
            placeholder={field.value ? undefined : appointments.chooseType}
            required
            value={field.value}
            onChange={(id) => {
              field.onChange(id);
              // A type chosen is one of the active ones: the archived one it may be on is already chosen.
              setValue("length", lengthOf(activeTypes.find((entry) => entry.id === id)!.minutes));
            }}
            onBlur={field.onBlur}
            error={errors.typeId?.message}
          />
        )}
      />
      <div className="grid gap-3">
        <Controller
          control={control}
          name="length.choice"
          render={({ field }) => (
            <ChoiceField
              label={appointments.lengthLabel}
              value={field.value}
              options={LENGTH_OPTIONS}
              onChange={(choice) => {
                // Other starts from the length it leaves, to change rather than type afresh.
                if (choice === OTHER_LENGTH && !getValues("length.other")) setValue("length.other", field.value);
                field.onChange(choice);
              }}
            />
          )}
        />
        {lengthChoice === OTHER_LENGTH && (
          <TextField
            label={appointments.minutesLabel}
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            required
            error={errors.length?.other?.message}
            {...register("length.other")}
          />
        )}
      </div>
      <TextAreaField
        label={appointments.notesLabel}
        hint={appointments.notesHint}
        autoComplete="off"
        maxLength={TEXT_LIMITS.notes}
        optional
        error={errors.notes?.message}
        {...register("notes")}
      />
    </FormSheet>
  );
}
