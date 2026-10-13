"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { useResponse } from "@/components/ui/response-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { ALERT_KIND_LABELS, ALERT_KINDS } from "@/constants/statuses";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { alertSchema, FORM_RESET_OPTIONS, type AlertInput, type AlertPayload } from "@/lib/validation";

import { AlertsClient } from "../api.client";
import type { PatientAlert } from "../types";

const { alerts } = UI_TEXT;
const KIND_OPTIONS = ALERT_KINDS.map((kind) => ({ value: kind, label: ALERT_KIND_LABELS[kind] }));

/**
 * Adding an alert, or changing one (plan §10.4, D119): its kind — an
 * allergy, a condition or a medication, chosen once and never changed — its
 * name, and an optional note. It opens over the alerts sheet.
 */
export function AlertSheet({
  open,
  onClose,
  patientId,
  alert,
  also = [],
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  /** The alert being changed; none to add one. */
  alert?: PatientAlert;
  /** Other reads that show the alerts — a visit's (D207) — made stale too. */
  also?: readonly string[];
}) {
  const respond = useResponse();
  const initial: AlertInput = alert
    ? { kind: alert.kind, label: alert.label, note: alert.note ?? "" }
    : { kind: "ALLERGY", label: "", note: "" };
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AlertInput, unknown, AlertPayload>({
    resolver: zodResolver(alertSchema),
    defaultValues: initial,
    resetOptions: FORM_RESET_OPTIONS,
  });

  const revalidate = [apiRoutes.patients.alerts(patientId), ...also];
  const added = useApiMutation(AlertsClient.add, {
    revalidate,
    onSuccess: (saved) => {
      reset(initial);
      onClose();
      respond.success({ title: alerts.added(saved.label) });
    },
    onError: (failure) => respond.failure(failure, { title: alerts.notAdded }),
  });
  const changed = useApiMutation(AlertsClient.update, {
    revalidate,
    onSuccess: (saved) => {
      onClose();
      respond.success({ title: alerts.saved(saved.label) });
    },
    onError: (failure) => respond.failure(failure, { title: alerts.notSaved }),
  });

  const save = ({ kind, label, note }: AlertPayload) =>
    void (alert
      ? changed.submit({ patientId, alertId: alert.id, label, note: note ?? "" })
      : added.submit({ patientId, kind, label, note: note ?? "" }));

  return (
    <FormSheet
      open={open}
      title={alert ? alerts.editTitle(ALERT_KIND_LABELS[alert.kind]) : alerts.addTitle}
      onClose={onClose}
      onSubmit={handleSubmit(save)}
      submitting={added.submitting || changed.submitting}
      submitLabel={alert ? UI_TEXT.actions.save : alerts.add}
    >
      {!alert && (
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <SegmentedControl
              label={alerts.kindLabel}
              value={field.value}
              options={KIND_OPTIONS}
              onChange={field.onChange}
            />
          )}
        />
      )}
      <TextField
        label={alerts.labelLabel}
        hint={alerts.labelHint}
        autoComplete="off"
        maxLength={TEXT_LIMITS.alertLabel}
        required
        error={errors.label?.message}
        {...register("label")}
      />
      <TextField
        label={alerts.noteLabel}
        hint={alerts.noteHint}
        autoComplete="off"
        maxLength={TEXT_LIMITS.alertNote}
        optional
        error={errors.note?.message}
        {...register("note")}
      />
    </FormSheet>
  );
}
