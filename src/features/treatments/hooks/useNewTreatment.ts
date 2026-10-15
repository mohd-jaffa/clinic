"use client";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { TreatmentsClient } from "../api.client";
import { treatmentRoutes } from "../keys";

const { treatments: words } = UI_TEXT;

/**
 * Adding a treatment (plan §14.1; D252, D258), from a visit or the profile:
 * the card names it, and the visit, the summary and the history are read
 * again. Answers whether it was added, so the sheet can close.
 */
export function useNewTreatment({ patientId, visitId }: { patientId: string; visitId: string | null }) {
  const respond = useResponse();
  const adding = useApiMutation(TreatmentsClient.create, {
    revalidate: treatmentRoutes(patientId, visitId),
    onSuccess: (made) => respond.success({ title: words.created(made.name) }),
    onError: (failure) => respond.failure(failure, { title: words.notCreated }),
  });
  return { adding: adding.submitting, add: adding.submit };
}
