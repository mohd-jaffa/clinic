"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { useResponse } from "@/components/ui/response-card";
import { TextAreaField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { appointmentNotesSchema, FORM_RESET_OPTIONS, type AppointmentNotesInput } from "@/lib/validation";

import { AppointmentsClient } from "../api.client";
import { appointmentRoutes } from "../keys";
import type { AppointmentDetail } from "../types";

const { appointment: words, appointments } = UI_TEXT;

/**
 * An appointment's notes, changed once it can no longer move (D161) — arrived,
 * a walk-in, done or cancelled: notes change at any time (plan §11.1). Saved,
 * everything closes with a card; closing this goes back to the detail.
 */
export function NotesSheet({
  appointment,
  open,
  onClose,
  onDone,
}: {
  appointment: AppointmentDetail;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const respond = useResponse();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<AppointmentNotesInput>({
    resolver: zodResolver(appointmentNotesSchema) as Resolver<AppointmentNotesInput>,
    defaultValues: { notes: appointment.notes ?? "" },
    resetOptions: FORM_RESET_OPTIONS,
  });
  const saving = useApiMutation(AppointmentsClient.change, {
    revalidate: appointmentRoutes(appointment),
    onSuccess: () => {
      onDone();
      respond.success({ title: words.notesSaved(appointment.patientName) });
    },
    onError: (failure) => respond.failure(failure, { title: words.notChanged }),
  });

  return (
    <FormSheet
      open={open}
      title={words.editNotes}
      onClose={onClose}
      // What was typed is sent, to be read once more by the route.
      onSubmit={handleSubmit(() => saving.submit({ id: appointment.id, input: getValues() }))}
      submitting={saving.submitting}
    >
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
