"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, Search } from "lucide-react";
import { useState } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type Resolver,
  type UseFormRegister,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { ChoiceField } from "@/components/ui/choice-field";
import { ClockField } from "@/components/ui/clock-field";
import { DateField } from "@/components/ui/date-field";
import { FormSheet } from "@/components/ui/form-sheet";
import { PhoneField } from "@/components/ui/phone-field";
import { useResponse } from "@/components/ui/response-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectField } from "@/components/ui/select-field";
import { TextAreaField, TextField } from "@/components/ui/text-field";
import { FIRST_HOUR_SHOWN, MAX_PATIENT_AGE, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { hasAccess } from "@/constants/permissions";
import { GENDER_LABELS, GENDERS } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAppointmentTypes } from "@/features/clinic/hooks/useAppointmentTypes";
import type { AppointmentType } from "@/features/clinic/types";
import { PatientMatches } from "@/features/patients/components/PatientMatches";
import type { PatientPrefill } from "@/features/patients/prefill";
import { useDoctors } from "@/features/team/hooks/useDoctors";
import { ApiError } from "@/lib/api/client";
import { requestKeys } from "@/lib/api/request-key";
import { estimatedBirthDate } from "@/lib/dates/age";
import { clinicHour, dayKey, todayKey } from "@/lib/dates/calendar";
import { formatDayMonth, formatTime } from "@/lib/format/date";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import {
  BORN_AS,
  bookingSchema,
  FORM_RESET_OPTIONS,
  HOURS,
  LENGTH_CHOICES,
  MINUTES,
  OTHER_LENGTH,
  type BookingInput,
  type BookingPayload,
  type PatientMode,
} from "@/lib/validation";

import { AppointmentsClient } from "../api.client";
import { DoctorDay } from "./DoctorDay";
import { PatientPicker, type ChosenPatient } from "./PatientPicker";

const { appointments, patients } = UI_TEXT;
const GENDER_OPTIONS = GENDERS.map((gender) => ({ value: gender, label: GENDER_LABELS[gender] }));
const BORN_OPTIONS = BORN_AS.map((as) => ({ value: as, label: patients.bornAs[as] }));
const LENGTH_OPTIONS = [
  ...LENGTH_CHOICES.map((minutes) => ({ value: minutes, label: appointments.minutes(Number(minutes)) })),
  { value: OTHER_LENGTH, label: appointments.otherLength },
];

/**
 * The sheet's own form: the booking as `bookingSchema` reads it, with every
 * field of a new patient held as a string from the start, though only the
 * mode chosen is read.
 */
type BookingForm = Omit<BookingInput, "patient"> & {
  patient: {
    mode: PatientMode;
    id: string;
    fullName: string;
    phone: string;
    born: { as: string; date: string; years: string };
    gender: string;
  };
};

/** A type's own length as the chips hold it (D151): its chip, or Other with its minutes. */
function lengthOf(minutes: number): BookingForm["length"] {
  const chip = LENGTH_CHOICES.find((choice) => Number(choice) === minutes);
  return chip ? { choice: chip, other: "" } : { choice: OTHER_LENGTH, other: String(minutes) };
}

/** No patient yet: none found, and a new one's fields empty. */
const NO_PATIENT: BookingForm["patient"] = {
  mode: "FOUND",
  id: "",
  fullName: "",
  phone: "",
  born: { as: "DATE", date: "", years: "" },
  gender: "",
};

/** What a tap on the calendar's grid starts a booking with (D156): its doctor, its day and its time. */
export type BookingPrefill = Pick<BookingForm, "doctorId" | "date" | "time">;

/** What the sheet starts with (D149): today, the doctor, the clinic's first type and its length; no time. */
const blank = (doctorId: string, type: AppointmentType | undefined): BookingForm => ({
  patient: structuredClone(NO_PATIENT),
  doctorId,
  date: todayKey(),
  time: { hour: "", minute: "" },
  typeId: type?.id ?? "",
  length: type ? lengthOf(type.minutes) : { choice: "", other: "" },
  notes: "",
});

/** What a refusal names (D145, D148): the time it clashed with, the closure it fell on, the patient added. */
interface Refusal {
  startsAt?: string;
  endsAt?: string;
  reason?: string;
  wholeClinic?: boolean;
  patient?: ChosenPatient;
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
 */
export function BookingSheet({
  open,
  onClose,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  /** Where a tap on the calendar's grid started it (D156). */
  prefill?: BookingPrefill;
}) {
  const respond = useResponse();
  const { membership } = useAuth();
  const doctors = useDoctors().data ?? [];
  const types = (useAppointmentTypes().data ?? []).filter((type) => type.active);
  const ownDoctor = doctors.find((doctor) => doctor.id === membership?.doctorId)?.id;
  const firstDoctor = ownDoctor ?? (doctors.length === 1 ? doctors[0].id : "");
  const canAddPatient = membership !== null && hasAccess(membership, "patients.create");

  const [keys] = useState(requestKeys);
  const [patientKeys] = useState(requestKeys);
  const [chosen, setChosen] = useState<ChosenPatient | null>(null);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitted },
  } = useForm<BookingForm, unknown, BookingPayload>({
    resolver: zodResolver(bookingSchema) as Resolver<BookingForm, unknown, BookingPayload>,
    defaultValues: { ...blank(firstDoctor, types[0]), ...prefill },
    resetOptions: FORM_RESET_OPTIONS,
  });
  const [mode, doctorId, date, lengthChoice] = useWatch({
    control,
    name: ["patient.mode", "doctorId", "date", "length.choice"],
  });
  const doctorName = (id: string) => doctors.find((doctor) => doctor.id === id)?.name ?? "";
  // Who and with whom the booking sent is, for the card that answers it: the form still holds it.
  const sent = () => {
    const { patient, doctorId: doctor } = getValues();
    return {
      // A patient found is the one chosen: the form refuses a booking without one.
      patient: patient.mode === "NEW" ? patient.fullName.trim() : chosen!.name,
      doctor: doctorName(doctor),
    };
  };

  const choose = (patient: ChosenPatient | null) => {
    setChosen(patient);
    setValue("patient.mode", "FOUND");
    setValue("patient.id", patient ? patient.id : "", { shouldValidate: isSubmitted && patient !== null });
  };
  const addNew = (prefill: PatientPrefill) => {
    setValue("patient.mode", "NEW");
    setValue("patient.fullName", prefill.fullName ?? "");
    setValue("patient.phone", prefill.phone ?? "");
  };

  const booking = useApiMutation(AppointmentsClient.book, {
    revalidate: [
      apiRoutes.appointments.list,
      apiRoutes.appointments.booked,
      apiRoutes.patients.search,
      apiRoutes.patients.matches,
    ],
    onSuccess: (booked) => {
      const { patient, doctor } = sent();
      keys.settle();
      patientKeys.settle();
      setChosen(null);
      reset(blank(firstDoctor, types[0]));
      onClose();
      respond.success({
        title: appointments.booked(
          patient,
          appointments.bookedWhen(formatDayMonth(dayKey(booked.scheduledAt)), formatTime(booked.scheduledAt)),
          doctor,
        ),
      });
    },
    onError: (failure) => {
      const { doctor } = sent();
      const named = (failure instanceof ApiError ? failure.details : undefined) as Refusal | undefined;
      // Added before the booking was refused, the patient stays added (D145): go on with them found.
      if (named?.patient) choose(named.patient);
      let title: string = appointments.notBooked;
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
    },
  });

  const save = () => {
    // A copy: the birth is an object the form goes on changing in place.
    const values = structuredClone(getValues());
    const input =
      values.patient.mode === "NEW" ? { ...values, patientKey: patientKeys.keyFor(values.patient) } : values;
    void booking.submit({ input, key: keys.keyFor(input) });
  };

  return (
    <FormSheet
      open={open}
      title={appointments.bookTitle}
      onClose={onClose}
      onSubmit={handleSubmit(save)}
      submitting={booking.submitting}
      submitLabel={appointments.book}
      submitIcon={CalendarPlus}
    >
      {mode === "NEW" ? (
        <NewPatientFields
          control={control}
          register={register}
          errors={errors}
          onChoose={choose}
          onFind={() => setValue("patient.mode", "FOUND")}
        />
      ) : (
        <PatientPicker
          chosen={chosen}
          onChoose={choose}
          onClear={() => choose(null)}
          onNew={canAddPatient ? addNew : undefined}
          error={errors.patient?.id?.message}
        />
      )}
      <Controller
        control={control}
        name="doctorId"
        render={({ field }) => (
          <SelectField
            ref={field.ref}
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
      <DoctorDay doctorId={doctorId} doctorName={doctorName(doctorId)} date={date} />
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
              // A type offered is one of these.
              setValue("length", lengthOf(types.find((entry) => entry.id === id)!.minutes));
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

/**
 * A new patient added with the booking (D145): what every patient needs —
 * name, mobile, date of birth or age, gender — the rest waiting for their
 * profile. "Already here?" lists the patients already on the mobile, to
 * choose one of them instead; **Find a patient instead** goes back to the
 * search.
 */
function NewPatientFields({
  control,
  register,
  errors,
  onChoose,
  onFind,
}: {
  control: Control<BookingForm, unknown, BookingPayload>;
  register: UseFormRegister<BookingForm>;
  errors: FieldErrors<BookingForm>;
  onChoose: (patient: ChosenPatient) => void;
  onFind: () => void;
}) {
  const [phone, bornAs] = useWatch({ control, name: ["patient.phone", "patient.born.as"] });
  const today = todayKey();
  const refused = errors.patient;
  return (
    <section aria-label={appointments.newPatient} className="grid gap-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-body font-bold text-ink">{appointments.newPatient}</h3>
        <Button variant="quiet" size="sm" icon={Search} label={appointments.findPatient} onClick={onFind} />
      </div>
      <TextField
        label={patients.nameLabel}
        autoComplete="off"
        maxLength={TEXT_LIMITS.personName}
        required
        error={refused?.fullName?.message}
        {...register("patient.fullName")}
      />
      <div>
        <PhoneField
          label={patients.mobileLabel}
          autoComplete="off"
          required
          error={refused?.phone?.message}
          {...register("patient.phone")}
        />
        <PatientMatches typed={phone} onChoose={onChoose} />
      </div>
      <div className="grid gap-3">
        <Controller
          control={control}
          name="patient.born.as"
          render={({ field }) => (
            <SegmentedControl
              label={patients.bornLabel}
              value={field.value}
              options={BORN_OPTIONS}
              onChange={field.onChange}
            />
          )}
        />
        {bornAs === "AGE" ? (
          <TextField
            key="age"
            label={patients.ageLabel}
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            hint={patients.ageHint}
            required
            error={refused?.born?.years?.message}
            {...register("patient.born.years")}
          />
        ) : (
          <Controller
            key="date"
            control={control}
            name="patient.born.date"
            render={({ field }) => (
              <DateField
                ref={field.ref}
                label={patients.dateOfBirthLabel}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                min={estimatedBirthDate(MAX_PATIENT_AGE, today)}
                max={today}
                required
                error={refused?.born?.date?.message}
              />
            )}
          />
        )}
      </div>
      <Controller
        control={control}
        name="patient.gender"
        render={({ field }) => (
          <ChoiceField
            label={patients.genderLabel}
            value={field.value}
            options={GENDER_OPTIONS}
            onChange={field.onChange}
            required
            error={refused?.gender?.message}
          />
        )}
      />
    </section>
  );
}
