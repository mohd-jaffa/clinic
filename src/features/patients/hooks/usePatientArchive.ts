"use client";

import { Archive } from "lucide-react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { ApiError } from "@/lib/api/client";
import { dayKey } from "@/lib/dates/calendar";
import { formatDayMonth } from "@/lib/format/date";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { PatientsClient } from "../api.client";
import type { Patient } from "../types";

const { patients } = UI_TEXT;

/** The day of the first appointment still to come, from an archive refused for it (D140). */
function upcomingDay(failure: unknown): string | null {
  if (!(failure instanceof ApiError) || failure.code !== "PATIENT_HAS_APPOINTMENTS") return null;
  const at = (failure.details as { scheduledAt?: unknown } | undefined)?.scheduledAt;
  return typeof at === "string" ? formatDayMonth(dayKey(at)) : null;
}

/**
 * Archiving and restoring a patient (plan §10.1, D103, D122 – D125). Archive
 * asks first (AGENTS.md §23) and answers whether it was archived, so the
 * sheet it was asked from can close; the profile stays, saying they are
 * archived (D124). One with an appointment still to come is refused, the
 * card naming its day (D140). Restore needs no asking (D125): it only brings
 * them back.
 * Either way the lists, "Already here?" and the profile are read again.
 */
export function usePatientArchive(patient: Patient) {
  const respond = useResponse();
  const revalidate = [apiRoutes.patients.search, apiRoutes.patients.matches, apiRoutes.patients.one(patient.id)];

  const archiving = useApiMutation(PatientsClient.archive, {
    revalidate,
    onSuccess: (saved) => respond.success({ title: patients.archivedNote(saved.name) }),
    onError: (failure) => {
      const day = upcomingDay(failure);
      respond.failure(failure, { title: day ? patients.hasAppointmentOn(patient.name, day) : patients.notArchived });
    },
  });
  const restoring = useApiMutation(PatientsClient.restore, {
    revalidate,
    onSuccess: (saved) => respond.success({ title: patients.restoredNote(saved.name) }),
    onError: (failure) => respond.failure(failure, { title: patients.notRestored }),
  });

  const archive = async (): Promise<boolean> => {
    const sure = await respond.confirm({
      title: patients.archiveTitle(patient.name),
      message: patients.archiveBody,
      confirmLabel: UI_TEXT.actions.archive,
      confirmIcon: Archive,
    });
    if (!sure) return false;
    return (await archiving.submit(patient.id)) !== undefined;
  };

  return {
    archive,
    archiving: archiving.submitting,
    restore: () => restoring.submit(patient.id),
    restoring: restoring.submitting,
  };
}
