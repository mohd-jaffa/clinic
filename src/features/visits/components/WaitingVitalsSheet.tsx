"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import type { Resolver } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { LoadFailed } from "@/components/ui/list-screen";
import { useResponse } from "@/components/ui/response-card";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Sheet } from "@/components/ui/sheet";
import { UI_TEXT } from "@/constants/messages";
import { appointmentRoutes } from "@/features/appointments/keys";
import type { AppointmentDetail } from "@/features/appointments/types";
import { ApiError } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { useApiQuery } from "@/lib/query/useApiQuery";
import { useRevalidate } from "@/lib/query/useRevalidate";
import { vitalsSchema, type VitalsInput } from "@/lib/validation";

import { VisitsClient } from "../api.client";
import { useVisitSection } from "../hooks/useVisitSection";
import type { Visit, Vitals } from "../types";
import { vitalsInput } from "../vitals";
import { ChangedMeanwhile } from "./ChangedMeanwhile";
import { VitalsFields } from "./VitalsFields";
import { VitalsReadout } from "./VitalsReadout";

const { visit: words } = UI_TEXT;

/**
 * The vitals of a patient still waiting (D203), from their appointment's
 * detail, for `visits.create`: an assistant takes them before the patient
 * goes in, and their visit opens with the first reading — Send in then
 * continues it. Readings already taken, on a visit opened earlier, are read
 * first, so they are changed rather than written over (D206).
 */
export function WaitingVitalsSheet({
  appointment,
  open,
  onClose,
  onDone,
}: {
  appointment: AppointmentDetail;
  open: boolean;
  onClose: () => void;
  /** Saved: everything it was opened from closes too. */
  onDone: () => void;
}) {
  // Read once first opened — not while the detail's other sheets are.
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  const visitRoute = appointment.visitId ? apiRoutes.visits.one(appointment.visitId) : null;
  const query = useApiQuery<Visit>(opened ? visitRoute : null);
  const title = words.vitalsFor(appointment.patientName);
  if (visitRoute && query.data === undefined) {
    return (
      <Sheet open={open} onClose={onClose} title={title}>
        {query.error != null ? (
          <LoadFailed query={query} loadFailed="VISIT_LOAD_FAILED" />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={2} />
          </section>
        )}
      </Sheet>
    );
  }
  return (
    <VitalsSheetForm
      appointment={appointment}
      saved={query.data?.vitals ?? null}
      visitRoute={visitRoute}
      title={title}
      open={open}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

function VitalsSheetForm({
  appointment,
  saved,
  visitRoute,
  title,
  open,
  onClose,
  onDone,
}: {
  appointment: AppointmentDetail;
  saved: Vitals | null;
  visitRoute: string | null;
  title: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const respond = useResponse();
  const refresh = useRevalidate();
  const stale = [...appointmentRoutes(appointment), ...(visitRoute ? [visitRoute] : [])];
  const section = useVisitSection({
    saved,
    toInput: vitalsInput,
    resolver: zodResolver(vitalsSchema) as unknown as Resolver<VitalsInput>,
  });
  const saving = useApiMutation(
    (input: VitalsInput) =>
      VisitsClient.saveWaitingVitals({ appointmentId: appointment.id, input: { vitals: input, seen: section.seen } }),
    {
      revalidate: stale,
      onSuccess: () => {
        onDone();
        respond.success({ title: words.vitalsSavedFor(appointment.patientName) });
      },
      onError: (failure) => {
        // Someone took them meanwhile: theirs is read, to show beside what is typed.
        if (failure instanceof ApiError && failure.code === "VISIT_CHANGED") void refresh(stale);
        respond.failure(failure, { title: words.notSaved });
      },
    },
  );

  return (
    <FormSheet
      open={open}
      title={title}
      onClose={onClose}
      submitLabel={words.saveVitals}
      // What was typed is sent, to be read once more by the route.
      onSubmit={section.form.handleSubmit(() => saving.submit(section.form.getValues()))}
      submitting={saving.submitting}
    >
      <VitalsFields form={section.form} />
      {section.theirs !== undefined && (
        <ChangedMeanwhile onTake={section.takeTheirs}>
          <VitalsReadout vitals={section.theirs} />
        </ChangedMeanwhile>
      )}
    </FormSheet>
  );
}
