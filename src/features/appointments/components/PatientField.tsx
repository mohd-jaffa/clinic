"use client";

import { Search } from "lucide-react";
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { ChoiceField } from "@/components/ui/choice-field";
import { DateField } from "@/components/ui/date-field";
import { PhoneField } from "@/components/ui/phone-field";
import { Row, RowList } from "@/components/ui/row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";
import { MAX_PATIENT_AGE, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { GENDER_LABELS, GENDERS } from "@/constants/statuses";
import { PatientMatches } from "@/features/patients/components/PatientMatches";
import { estimatedBirthDate } from "@/lib/dates/age";
import { todayKey } from "@/lib/dates/calendar";
import { BORN_AS } from "@/lib/validation";

import type { AppointmentForm } from "../form";
import type { usePatientChoice } from "../hooks/usePatientChoice";
import { PatientPicker, type ChosenPatient } from "./PatientPicker";

const { appointments, patients } = UI_TEXT;
const GENDER_OPTIONS = GENDERS.map((gender) => ({ value: gender, label: GENDER_LABELS[gender] }));
const BORN_OPTIONS = BORN_AS.map((as) => ({ value: as, label: patients.bornAs[as] }));

/** The patient a sheet is opened for, and who stays (D161, D166): no search, no **Change**. */
export type FixedPatient = Pick<ChosenPatient, "id" | "name" | "number">;

/**
 * Who a booking or a walk-in is for (D144, D145, D166): the patient it was
 * opened for, fixed; a new patient's fields; or the search — with **New
 * patient** for whoever may add one.
 */
export function PatientField({
  control,
  register,
  errors,
  setValue,
  mode,
  fixed,
  canAdd,
  choice,
}: {
  control: Control<AppointmentForm>;
  register: UseFormRegister<AppointmentForm>;
  errors: FieldErrors<AppointmentForm>;
  setValue: UseFormSetValue<AppointmentForm>;
  mode: AppointmentForm["patient"]["mode"];
  fixed?: FixedPatient;
  canAdd: boolean;
  choice: ReturnType<typeof usePatientChoice>;
}) {
  if (fixed) {
    return (
      <div>
        <p className="mb-1.5 text-small font-bold text-ink">{appointments.patientLabel}</p>
        <RowList label={appointments.patientLabel} look="menu">
          <Row look="menu" title={fixed.name} subtitle={patients.number(fixed.number)} />
        </RowList>
      </div>
    );
  }
  if (mode === "NEW") {
    return (
      <NewPatientFields
        control={control}
        register={register}
        errors={errors}
        onChoose={choice.choose}
        onFind={() => setValue("patient.mode", "FOUND")}
      />
    );
  }
  return (
    <PatientPicker
      chosen={choice.chosen}
      onChoose={choice.choose}
      onClear={() => choice.choose(null)}
      onNew={canAdd ? choice.addNew : undefined}
      error={errors.patient?.id?.message}
    />
  );
}

/**
 * A new patient added with the booking or the walk-in (D145): what every patient needs —
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
  control: Control<AppointmentForm>;
  register: UseFormRegister<AppointmentForm>;
  errors: FieldErrors<AppointmentForm>;
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
