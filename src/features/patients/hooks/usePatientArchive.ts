"use client";

import { Archive } from "lucide-react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { PatientsClient } from "../api.client";
import type { Patient } from "../types";

const { patients } = UI_TEXT;

/**
 * Archiving and restoring a patient (plan §10.1, D103, D122 – D125). Archive
 * asks first (AGENTS.md §23) and answers whether it was archived, so the
 * sheet it was asked from can close; the profile stays, saying they are
 * archived (D124). Restore needs no asking (D125): it only brings them back.
 * Either way the lists, "Already here?" and the profile are read again.
 */
export function usePatientArchive(patient: Patient) {
  const respond = useResponse();
  const revalidate = [apiRoutes.patients.search, apiRoutes.patients.matches, apiRoutes.patients.one(patient.id)];

  const archiving = useApiMutation(PatientsClient.archive, {
    revalidate,
    onSuccess: (saved) => respond.success({ title: patients.archivedNote(saved.name) }),
    onError: (failure) => respond.failure(failure, { title: patients.notArchived }),
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
