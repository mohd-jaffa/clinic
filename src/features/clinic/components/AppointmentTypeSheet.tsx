"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { useResponse } from "@/components/ui/response-card";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { appointmentTypeSchema, type AppointmentTypeInput, type AppointmentTypePayload } from "@/lib/validation";

import { AppointmentTypesClient } from "../api.client";
import { useCatalogueChange } from "../hooks/useCatalogueChange";
import type { AppointmentType } from "../types";
import { ArchiveEntryButton } from "./ArchiveEntryButton";

const { appointmentTypes, catalogues } = UI_TEXT;

/** What the sheet holds: the type as it is, or nothing yet for a new one. */
const formOf = (type: AppointmentType | null): AppointmentTypeInput => ({
  name: type?.name ?? "",
  minutes: type ? String(type.minutes) : "",
});

/**
 * One appointment type (plan §9, D32): a new one, or one being changed — its
 * name and how long it usually takes, which a booking starts from. A type
 * being changed can be archived from here (D80), asked first; the last one
 * cannot (D83).
 */
export function AppointmentTypeSheet({
  open,
  onClose,
  type,
}: {
  open: boolean;
  onClose: () => void;
  /** The type being changed; none adds one. */
  type: AppointmentType | null;
}) {
  const respond = useResponse();
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<AppointmentTypeInput, unknown, AppointmentTypePayload>({
    resolver: zodResolver(appointmentTypeSchema),
    defaultValues: formOf(type),
  });

  const { submit, submitting } = useApiMutation(
    (input: AppointmentTypeInput) =>
      type ? AppointmentTypesClient.change({ id: type.id, details: input }) : AppointmentTypesClient.add(input),
    {
      revalidate: [apiRoutes.appointmentTypes.list],
      onSuccess: (saved) => {
        // A new one's sheet is left empty for the next; a changed one's holds what was saved.
        reset(formOf(type && saved));
        onClose();
        respond.success({ title: type ? catalogues.savedNote(saved.name) : appointmentTypes.added(saved.name) });
      },
      onError: (failure) => respond.failure(failure, { title: appointmentTypes.notSaved }),
    },
  );

  const { archive, archiving } = useCatalogueChange({
    change: AppointmentTypesClient.change,
    list: apiRoutes.appointmentTypes.list,
  });

  return (
    <FormSheet
      open={open}
      title={type ? appointmentTypes.editTitle : appointmentTypes.addTitle}
      onClose={onClose}
      onSubmit={handleSubmit(() => submit(getValues()))}
      submitting={submitting}
    >
      <TextField
        label={appointmentTypes.nameLabel}
        autoComplete="off"
        maxLength={TEXT_LIMITS.catalogueName}
        required
        error={errors.name?.message}
        {...register("name")}
      />
      <TextField
        label={appointmentTypes.minutesLabel}
        hint={appointmentTypes.minutesHint}
        inputMode="numeric"
        autoComplete="off"
        maxLength={3}
        required
        error={errors.minutes?.message}
        {...register("minutes")}
      />
      {type && (
        <ArchiveEntryButton
          archive={() =>
            archive(type, { title: appointmentTypes.archiveTitle(type.name), message: appointmentTypes.archiveBody })
          }
          archiving={archiving}
          onArchived={onClose}
        />
      )}
    </FormSheet>
  );
}
