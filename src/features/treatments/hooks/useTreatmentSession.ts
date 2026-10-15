"use client";

import { Trash2 } from "lucide-react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { ApiError } from "@/lib/api/client";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { useRevalidate } from "@/lib/query/useRevalidate";
import type { TreatmentSessionInput } from "@/lib/validation";

import { TreatmentsClient } from "../api.client";
import { treatmentRoutes } from "../keys";
import type { SessionSaved, Treatment } from "../types";

const { treatments: words } = UI_TEXT;

/**
 * What a visit did for a treatment (D248, D256, D257, D254): its session
 * saved — the note, and the treatment completed with it when the box is
 * ticked — or removed, asking first, while the visit is open. A save made
 * from an older copy is refused (VISIT_CHANGED) and theirs is read, to show
 * beside what is typed (D251). Done, `onDone` closes the sheet and the card
 * says so; the visit, the summary and the history are read again.
 */
export function useTreatmentSession(
  treatment: Treatment,
  visitId: string,
  { onSaved, onDone }: { onSaved: (saved: SessionSaved) => void; onDone: () => void },
) {
  const respond = useResponse();
  const refresh = useRevalidate();
  const routes = treatmentRoutes(treatment.patientId, visitId);
  const saving = useApiMutation(
    (input: TreatmentSessionInput) => TreatmentsClient.recordSession({ id: treatment.id, visitId, input }),
    {
      revalidate: routes,
      onSuccess: (saved) => {
        onSaved(saved);
        onDone();
        respond.success({
          title:
            saved.status === "COMPLETED" && treatment.status !== "COMPLETED"
              ? words.sessionCompleted(treatment.name)
              : words.sessionSaved(treatment.name),
        });
      },
      onError: (failure) => {
        // Someone saved it meanwhile: theirs is read, to show beside what is typed.
        if (failure instanceof ApiError && failure.code === "VISIT_CHANGED") void refresh(routes);
        respond.failure(failure, { title: words.notSaved });
      },
    },
  );
  const removing = useApiMutation(() => TreatmentsClient.removeSession({ id: treatment.id, visitId }), {
    revalidate: routes,
    onSuccess: () => {
      onDone();
      respond.success({ title: words.removed(treatment.name) });
    },
    onError: (failure) => respond.failure(failure, { title: words.notRemoved }),
  });

  return {
    saving: saving.submitting,
    save: saving.submit,
    removing: removing.submitting,
    remove: async () => {
      const sure = await respond.confirm({
        title: words.removeTitle(treatment.name),
        message: words.removeBody,
        confirmLabel: words.removeSession,
        confirmIcon: Trash2,
        tone: "danger",
      });
      if (sure) await removing.submit(undefined);
    },
  };
}
