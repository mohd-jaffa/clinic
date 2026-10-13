"use client";

import { useRouter } from "next/navigation";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { visitRoute } from "@/constants/navigation";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { VisitsClient } from "../api.client";

const { visit: words } = UI_TEXT;

/**
 * **New visit** (D204): starts the patient's visit with the doctor chosen —
 * or finds the one already open with them, and says so — then opens it.
 */
export function useStartVisit(patient: { name: string }, doctorName: (doctorId: string) => string) {
  const respond = useResponse();
  const router = useRouter();
  const starting = useApiMutation(VisitsClient.start, {
    onError: (failure) => respond.failure(failure, { title: words.notStarted }),
  });
  return {
    starting: starting.submitting,
    start: async (input: { patientId: string; doctorId: string }) => {
      const started = await starting.submit(input);
      if (!started) return false;
      respond.success({
        title: started.created
          ? words.started(patient.name)
          : words.openedAgain(patient.name, doctorName(input.doctorId)),
      });
      router.push(visitRoute(started.visitId));
      return true;
    },
  };
}

/** **Done** for a visit started from a profile (D204): it closes as To bill, and the card says so. */
export function useFinishVisit(visit: { id: string; patient: { name: string } }) {
  const respond = useResponse();
  const finishing = useApiMutation(VisitsClient.done, {
    revalidate: [apiRoutes.visits.one(visit.id)],
    onSuccess: () => respond.success({ title: words.finished(visit.patient.name) }),
    onError: (failure) => respond.failure(failure, { title: words.notFinished }),
  });
  return { finishing: finishing.submitting, finish: () => finishing.submit(visit.id) };
}
