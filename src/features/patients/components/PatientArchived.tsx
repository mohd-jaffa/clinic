"use client";

import { Archive, ArchiveRestore } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UI_TEXT } from "@/constants/messages";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { dayKey } from "@/lib/dates/calendar";
import { formatDate } from "@/lib/format/date";

import { usePatientArchive } from "../hooks/usePatientArchive";
import type { Patient } from "../types";

const { patients } = UI_TEXT;

/**
 * An archived patient's notice, in their profile's header (D123): when they
 * were archived and by whom, that the profile is read-only until restored
 * (D103), and **Restore** for those who may — at once, unasked (D125). In a
 * view-only clinic it is not offered; the details say why.
 */
export function PatientArchived({ patient, archivedAt }: { patient: Patient; archivedAt: string }) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const { restore, restoring } = usePatientArchive(patient);
  const restores = membership !== null && hasAccess(membership, "patients.edit") && !readOnly;

  return (
    <div className="flex max-w-md items-start gap-3 rounded-row bg-surface px-4 py-3.5 text-ink">
      <Archive size={20} strokeWidth={2.25} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
      <div className="grid min-w-0 gap-1">
        <p className="font-bold">{patients.archivedOn(formatDate(dayKey(archivedAt)), patient.archivedBy)}</p>
        <p className="text-small text-muted">{patients.archivedHint}</p>
        {restores && (
          <div className="mt-2">
            <Button
              label={UI_TEXT.actions.restore}
              aria-label={patients.restoreName(patient.name)}
              icon={ArchiveRestore}
              variant="secondary"
              size="sm"
              loading={restoring}
              onClick={() => void restore()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
