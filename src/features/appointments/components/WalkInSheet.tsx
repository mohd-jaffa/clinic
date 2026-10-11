"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Footprints } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { useResponse } from "@/components/ui/response-card";
import { SelectField } from "@/components/ui/select-field";
import { UI_TEXT } from "@/constants/messages";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAppointmentTypes } from "@/features/clinic/hooks/useAppointmentTypes";
import { useDoctors } from "@/features/team/hooks/useDoctors";
import { ApiError } from "@/lib/api/client";
import { requestKeys } from "@/lib/api/request-key";
import { todayKey } from "@/lib/dates/calendar";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { FORM_RESET_OPTIONS, walkInSchema } from "@/lib/validation";

import { AppointmentsClient } from "../api.client";
import { NO_PATIENT, refusalOf, type AppointmentForm } from "../form";
import { usePatientChoice } from "../hooks/usePatientChoice";
import { walkInDoctor } from "../queue";
import { PatientField } from "./PatientField";

const { appointments, queue } = UI_TEXT;

/** What the sheet starts with (D171, D175): no patient, the doctor it opens on, the clinic's first type. */
const blank = (doctorId: string, typeId: string): AppointmentForm => ({
  patient: structuredClone(NO_PATIENT),
  doctorId,
  date: todayKey(),
  time: { hour: "", minute: "" },
  typeId,
  length: { choice: "", other: "" },
  notes: "",
});

/**
 * Adding a walk-in (plan §11.3; D139, D171, D173, D175): the patient — found
 * by the search, or added there with "Already here?" — the doctor and the
 * type. They arrive now, with the doctor's next token, so there is no time to
 * choose. It starts on the doctor whose queue is showing, else the one adding
 * it if they are a doctor, else the clinic's only doctor. Added, it closes and
 * the card gives the token to tell them: "Rohan Mehta is #7 with Maya Rao". A
 * closed day is named on the card; a new patient added before a refusal stays
 * added, and the sheet goes on with them found. Sent twice, it adds once.
 */
export function WalkInSheet({
  open,
  onClose,
  doctorId: queueDoctor,
}: {
  open: boolean;
  onClose: () => void;
  /** The doctor whose queue is showing — none for every doctor's. */
  doctorId: string;
}) {
  const respond = useResponse();
  const { membership } = useAuth();
  const doctors = useDoctors().data ?? [];
  const types = (useAppointmentTypes().data ?? []).filter((type) => type.active);
  const firstDoctor = walkInDoctor({ queueDoctor, ownDoctor: membership?.doctorId ?? null, doctors });
  const canAddPatient = membership !== null && hasAccess(membership, "patients.create");
  const [keys] = useState(requestKeys);
  const [patientKeys] = useState(requestKeys);
  const startsWith = () => blank(firstDoctor, types[0]?.id ?? "");

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
    resolver: zodResolver(walkInSchema) as unknown as Resolver<AppointmentForm>,
    defaultValues: startsWith(),
    resetOptions: FORM_RESET_OPTIONS,
  });
  const mode = useWatch({ control, name: "patient.mode" });
  const choice = usePatientChoice(setValue, isSubmitted);
  const doctorName = (id: string) => doctors.find((doctor) => doctor.id === id)?.name ?? "";
  // Who and with whom the walk-in sent is, for the card that answers it: the form still holds it.
  const sent = () => {
    const { patient, doctorId } = getValues();
    return {
      // A patient found is the one chosen: the form refuses a walk-in without one.
      patient: patient.mode === "NEW" ? patient.fullName.trim() : choice.chosen!.name,
      doctor: doctorName(doctorId),
    };
  };

  const adding = useApiMutation(AppointmentsClient.addWalkIn, {
    revalidate: [
      apiRoutes.queue.list,
      apiRoutes.appointments.list,
      apiRoutes.patients.search,
      apiRoutes.patients.matches,
    ],
    onSuccess: (walkedIn) => {
      const { patient, doctor } = sent();
      keys.settle();
      patientKeys.settle();
      choice.choose(null);
      reset(startsWith());
      onClose();
      respond.success({ title: queue.tokenGiven(patient, walkedIn.token, doctor) });
    },
    onError: (failure) => {
      const { doctor } = sent();
      const named = refusalOf(failure);
      // Added before the walk-in was refused, the patient stays added (D145): go on with them found.
      if (named?.patient) choice.choose(named.patient);
      let title: string = queue.notAdded;
      if (failure instanceof ApiError && failure.code === "APPOINTMENT_ON_CLOSED_DAY" && named?.reason) {
        title = named.wholeClinic
          ? appointments.clinicClosed(named.reason)
          : appointments.doctorAway(doctor, named.reason);
        setError("doctorId", { message: title });
      }
      respond.failure(failure, { title });
    },
  });

  const save = () => {
    // A copy: the birth is an object the form goes on changing in place.
    const { patient, doctorId, typeId } = structuredClone(getValues());
    const input = {
      patient,
      doctorId,
      typeId,
      ...(patient.mode === "NEW" && { patientKey: patientKeys.keyFor(patient) }),
    };
    void adding.submit({ input, key: keys.keyFor(input) });
  };

  return (
    <FormSheet
      open={open}
      title={queue.walkInTitle}
      onClose={onClose}
      onSubmit={handleSubmit(save)}
      submitting={adding.submitting}
      submitLabel={queue.addWalkIn}
      submitIcon={Footprints}
    >
      <PatientField
        control={control}
        register={register}
        errors={errors}
        setValue={setValue}
        mode={mode}
        canAdd={canAddPatient}
        choice={choice}
      />
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
        name="typeId"
        render={({ field }) => (
          <SelectField
            ref={field.ref}
            label={appointments.typeLabel}
            options={types.map(({ id, name }) => ({ value: id, label: name }))}
            placeholder={field.value ? undefined : appointments.chooseType}
            required
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.typeId?.message}
          />
        )}
      />
    </FormSheet>
  );
}
