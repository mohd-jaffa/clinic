"use client";

import { Archive, Plus } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { LoadFailed } from "@/components/ui/list-screen";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonRows } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { usePatientSummary } from "@/features/patients/hooks/usePatientSummary";
import type { Patient } from "@/features/patients/types";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";

import { inShowingOrder } from "../describe";
import { useOpenedTreatment } from "../hooks/useOpenedTreatment";
import { NewTreatmentSheet } from "./TreatmentForms";
import { TreatmentPanel } from "./TreatmentPanel";
import { TreatmentRows } from "./TreatmentRows";

const { treatments: words } = UI_TEXT;

/**
 * A patient's treatments on their profile (plan §10.3 item 3; D260, D261),
 * for `visits.view`: the open ones — name, status, doctor, when next due —
 * then **Show closed** for the completed and cancelled. Each opens its sheet;
 * **Add treatment**, for `visits.edit` while the clinic can write and the
 * patient is not archived, starts one for the doctor chosen — the caller, if
 * a doctor, or the patient's own.
 */
export function PatientTreatments({ patient }: { patient: Patient }) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const summary = usePatientSummary(patient.id);
  const headingId = useId();
  const all = summary.data?.treatments;
  const opened = useOpenedTreatment(all ?? []);
  const [adding, setAdding] = useState({ open: false, count: 0 });
  const writes =
    membership !== null && hasAccess(membership, "visits.edit") && !readOnly && patient.archivedAt === null;

  let body;
  if (all === undefined) {
    body =
      summary.error != null ? (
        <LoadFailed query={summary} loadFailed="TREATMENTS_LOAD_FAILED" />
      ) : (
        <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
          <SkeletonRows rows={1} />
        </section>
      );
  } else {
    const { open, closed } = inShowingOrder(all);
    body = (
      <div className="grid gap-3">
        {open.length === 0 ? (
          <p className="rounded-row bg-surface px-5 py-4 text-muted">{words.none}</p>
        ) : (
          <TreatmentRows label={words.title} treatments={open} onOpen={opened.show} />
        )}
        {closed.length > 0 && (
          <Disclosure
            label={words.closed}
            showLabel={words.showClosed(closed.length)}
            hideLabel={words.hideClosed}
            icon={Archive}
          >
            <TreatmentRows label={words.closed} treatments={closed} onOpen={opened.show} />
          </Disclosure>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId} title={words.title}>
        {writes && (
          <Button
            label={words.add}
            aria-label={words.addFor(patient.name)}
            icon={Plus}
            variant="secondary"
            size="sm"
            onClick={() => setAdding(({ count }) => ({ open: true, count: count + 1 }))}
          />
        )}
      </SectionHeading>
      {body}
      {writes && (
        <NewTreatmentSheet
          key={adding.count}
          patientId={patient.id}
          visitId={null}
          firstDoctor={membership?.doctorId ?? patient.assignedDoctorId ?? ""}
          open={adding.open}
          onClose={() => setAdding((now) => ({ ...now, open: false }))}
        />
      )}
      <TreatmentPanel
        treatment={opened.treatment}
        visit={null}
        writes={writes}
        open={opened.open}
        onClose={opened.close}
      />
    </section>
  );
}
