"use client";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { ApiError } from "@/lib/api/client";
import { formatLongDate } from "@/lib/format/date";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { useRevalidate } from "@/lib/query/useRevalidate";
import type { ChangeTreatmentInput } from "@/lib/validation";

import { TreatmentsClient } from "../api.client";
import { treatmentRoutes } from "../keys";
import type { Treatment, TreatmentDetails } from "../types";

const { treatments: words } = UI_TEXT;

/**
 * A change to a treatment (D251, D252, D259): its details, or its next
 * sitting, from the copy the screen read. One made from an older copy is
 * refused (TREATMENT_CHANGED) and theirs is read, to show beside what is
 * typed. Saved, `onSaved` takes what was saved, `onDone` closes what it was
 * asked from, and the card names it — the next sitting's day when that is
 * what changed.
 */
export function useTreatmentChange(
  treatment: Treatment,
  visitId: string | null,
  { onSaved, onDone }: { onSaved: (saved: Partial<TreatmentDetails>) => void; onDone: () => void },
) {
  const respond = useResponse();
  const refresh = useRevalidate();
  const routes = treatmentRoutes(treatment.patientId, visitId);
  const change = useApiMutation(
    async (input: ChangeTreatmentInput) => ({
      part: input.part,
      saved: await TreatmentsClient.change({ id: treatment.id, input }),
    }),
    {
      revalidate: routes,
      onSuccess: ({ part, saved }) => {
        onSaved(saved);
        onDone();
        const name = saved.name ?? treatment.name;
        let title = words.saved(name);
        if (part === "NEXT_DUE") {
          title = saved.nextDueOn
            ? words.nextDueSaved(name, formatLongDate(saved.nextDueOn))
            : words.nextDueRemoved(name);
        }
        respond.success({ title });
      },
      onError: (failure) => {
        if (failure instanceof ApiError && failure.code === "TREATMENT_CHANGED") void refresh(routes);
        respond.failure(failure, { title: words.notSaved });
      },
    },
  );
  return { saving: change.submitting, save: change.submit };
}
