"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";

import { ChoiceField } from "@/components/ui/choice-field";
import { DateField } from "@/components/ui/date-field";
import { Disclosure } from "@/components/ui/disclosure";
import { FormSheet } from "@/components/ui/form-sheet";
import { PhoneField } from "@/components/ui/phone-field";
import { useResponse } from "@/components/ui/response-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectField } from "@/components/ui/select-field";
import { TextAreaField, TextField } from "@/components/ui/text-field";
import { MAX_PATIENT_AGE, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { patientRoute } from "@/constants/navigation";
import { GENDER_LABELS, GENDERS } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { useDoctors } from "@/features/team/hooks/useDoctors";
import { requestKeys } from "@/lib/api/request-key";
import { ageOn, estimatedBirthDate } from "@/lib/dates/age";
import { todayKey } from "@/lib/dates/calendar";
import { formatPhoneDigits } from "@/lib/phone";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import {
  BORN_AS,
  FORM_RESET_OPTIONS,
  patientSchema,
  type PatientInput,
  type PatientPayload,
  type UpdatePatientInput,
} from "@/lib/validation";

import { PatientsClient } from "../api.client";
import type { Patient } from "../types";
import { PatientMatches } from "./PatientMatches";

const { patients } = UI_TEXT;
const GENDER_OPTIONS = GENDERS.map((gender) => ({ value: gender, label: GENDER_LABELS[gender] }));
const BORN_OPTIONS = BORN_AS.map((as) => ({ value: as, label: patients.bornAs[as] }));

/** What a search that found no one fills a new patient with (D112). */
export type PatientPrefill = Partial<Pick<PatientInput, "fullName" | "phone">>;

/** The fields kept under More details (D105). */
const MORE = ["altPhone", "email", "address", "emergencyContactName", "emergencyContactPhone", "notes"] as const;

const blank = (doctorId: string): PatientInput => ({
  fullName: "",
  phone: "",
  born: { as: "DATE", date: "", years: "" },
  gender: "",
  assignedDoctorId: doctorId,
  altPhone: "",
  email: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  notes: "",
});

/** A patient as the sheet edits them: an estimated birth as the age it came from (D100). */
const fromPatient = (patient: Patient): PatientInput => ({
  fullName: patient.name,
  phone: formatPhoneDigits(patient.phone),
  born: patient.dobIsEstimated
    ? { as: "AGE", date: "", years: String(ageOn(patient.dateOfBirth, todayKey())?.years ?? "") }
    : { as: "DATE", date: patient.dateOfBirth, years: "" },
  gender: patient.gender,
  assignedDoctorId: patient.assignedDoctorId ?? "",
  altPhone: patient.altPhone ?? "",
  email: patient.email ?? "",
  address: patient.address ?? "",
  emergencyContactName: patient.emergencyContactName ?? "",
  emergencyContactPhone: patient.emergencyContactPhone ?? "",
  notes: patient.notes ?? "",
});

/** What the edit changed: only the fields touched go, so an untouched age moves no date (D100). */
function changesFrom(initial: PatientInput, values: PatientInput): UpdatePatientInput {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([field, value]) => JSON.stringify(value) !== JSON.stringify(initial[field as keyof PatientInput]),
    ),
  );
}

/**
 * Adding a patient, or changing one (plan §10.1, D105 – D108). What every
 * patient needs comes first — name, mobile, date of birth or age, gender —
 * with their doctor; the rest waits under **More details**. Once a whole
 * mobile is typed, the patients already on it are listed under it to open
 * instead — a family shares one, so nothing is refused (D106). The doctor
 * starts as the doctor adding them, or the clinic's only doctor (D108). An
 * added patient's profile opens (D107); an add sent twice makes one.
 */
export function PatientSheet({
  open,
  onClose,
  patient,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  /** The patient being changed; none to add one. */
  patient?: Patient;
  /** What a new patient starts with, beside the blanks. */
  prefill?: PatientPrefill;
}) {
  const respond = useResponse();
  const router = useRouter();
  const { membership } = useAuth();
  const doctors = useDoctors().data ?? [];
  const only = doctors.length === 1 ? doctors[0].id : "";
  const initial = patient ? fromPatient(patient) : { ...blank(membership?.doctorId ?? only), ...prefill };
  const [keys] = useState(requestKeys);
  const [more, setMore] = useState(() => MORE.some((field) => initial[field] !== ""));

  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<PatientInput, unknown, PatientPayload>({
    resolver: zodResolver(patientSchema),
    defaultValues: initial,
    resetOptions: FORM_RESET_OPTIONS,
  });
  const [phone, bornAs] = useWatch({ control, name: ["phone", "born.as"] });

  const added = useApiMutation(PatientsClient.create, {
    revalidate: [apiRoutes.patients.search, apiRoutes.patients.matches],
    onSuccess: (saved) => {
      keys.settle();
      reset(initial);
      // In place of the add form, so Back leads to the list and not to the form again.
      router.replace(patientRoute(saved.id));
      respond.success({ title: patients.added(saved.name, patients.number(saved.number)) });
    },
    onError: (failure) => respond.failure(failure, { title: patients.notAdded }),
  });
  const changed = useApiMutation(PatientsClient.update, {
    revalidate: [
      apiRoutes.patients.search,
      apiRoutes.patients.matches,
      ...(patient ? [apiRoutes.patients.one(patient.id)] : []),
    ],
    onSuccess: (saved) => {
      onClose();
      respond.success({ title: patients.saved(saved.name) });
    },
    onError: (failure) => respond.failure(failure, { title: patients.notSaved }),
  });

  const save = () => {
    // A copy: the birth is an object the form goes on changing in place.
    const values = structuredClone(getValues());
    if (!patient) return void added.submit({ input: values, key: keys.keyFor(values) });
    const changes = changesFrom(initial, values);
    if (Object.keys(changes).length === 0) return onClose();
    void changed.submit({ id: patient.id, ...changes });
  };
  // A refused field under More details opens it, so the refusal is seen.
  const refused = (found: FieldErrors<PatientInput>) => {
    if (MORE.some((field) => found[field])) setMore(true);
  };

  const today = todayKey();
  return (
    <FormSheet
      open={open}
      title={patient ? patients.editTitle : patients.addTitle}
      onClose={onClose}
      onSubmit={handleSubmit(save, refused)}
      submitting={added.submitting || changed.submitting}
      submitLabel={patient ? UI_TEXT.actions.save : patients.add}
      submitIcon={patient ? undefined : UserPlus}
    >
      <TextField
        label={patients.nameLabel}
        autoComplete="off"
        maxLength={TEXT_LIMITS.personName}
        required
        error={errors.fullName?.message}
        {...register("fullName")}
      />
      <div>
        <PhoneField
          label={patients.mobileLabel}
          autoComplete="off"
          required
          error={errors.phone?.message}
          {...register("phone")}
        />
        {!patient && <PatientMatches typed={phone} />}
      </div>
      <div className="grid gap-3">
        <Controller
          control={control}
          name="born.as"
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
            error={errors.born?.years?.message}
            {...register("born.years")}
          />
        ) : (
          <Controller
            key="date"
            control={control}
            name="born.date"
            render={({ field }) => (
              <DateField
                ref={field.ref}
                label={patients.dateOfBirthLabel}
                // The sheet always holds a day key, "" for none.
                value={field.value as string}
                onChange={field.onChange}
                onBlur={field.onBlur}
                min={estimatedBirthDate(MAX_PATIENT_AGE, today)}
                max={today}
                required
                error={errors.born?.date?.message}
              />
            )}
          />
        )}
      </div>
      <Controller
        control={control}
        name="gender"
        render={({ field }) => (
          <ChoiceField
            label={patients.genderLabel}
            value={field.value}
            options={GENDER_OPTIONS}
            onChange={field.onChange}
            required
            error={errors.gender?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="assignedDoctorId"
        render={({ field }) => (
          <SelectField
            ref={field.ref}
            label={patients.doctorLabel}
            hint={patients.doctorHint}
            placeholder={patients.noDoctor}
            options={doctors.map(({ id, name }) => ({ value: id, label: name }))}
            // The sheet always holds an id, "" for none.
            value={field.value as string}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.assignedDoctorId?.message}
          />
        )}
      />
      <Disclosure
        label={patients.moreDetails}
        showLabel={patients.showMore}
        hideLabel={patients.hideMore}
        icon={ChevronDown}
        shown={more}
        onShownChange={setMore}
      >
        <div className="grid gap-5">
          <TextField
            label={patients.altPhoneLabel}
            hint={patients.altPhoneHint}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            maxLength={TEXT_LIMITS.phoneNumber}
            optional
            error={errors.altPhone?.message}
            {...register("altPhone")}
          />
          <TextField
            label={patients.emailLabel}
            type="email"
            inputMode="email"
            autoComplete="off"
            maxLength={TEXT_LIMITS.email}
            optional
            error={errors.email?.message}
            {...register("email")}
          />
          <TextAreaField
            label={patients.addressLabel}
            autoComplete="off"
            maxLength={TEXT_LIMITS.address}
            optional
            error={errors.address?.message}
            {...register("address")}
          />
          <TextField
            label={patients.emergencyNameLabel}
            autoComplete="off"
            maxLength={TEXT_LIMITS.personName}
            optional
            error={errors.emergencyContactName?.message}
            {...register("emergencyContactName")}
          />
          <TextField
            label={patients.emergencyPhoneLabel}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            maxLength={TEXT_LIMITS.phoneNumber}
            optional
            error={errors.emergencyContactPhone?.message}
            {...register("emergencyContactPhone")}
          />
          <TextAreaField
            label={patients.notesLabel}
            hint={patients.notesHint}
            autoComplete="off"
            maxLength={TEXT_LIMITS.notes}
            optional
            error={errors.notes?.message}
            {...register("notes")}
          />
        </div>
      </Disclosure>
    </FormSheet>
  );
}
