"use client";

import { Ban, CheckCheck } from "lucide-react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { TreatmentsClient } from "../api.client";
import { MOVE_STATUS, type StatusMove } from "../describe";
import { treatmentRoutes } from "../keys";
import type { Treatment } from "../types";

const { treatments: words } = UI_TEXT;

/**
 * Moving a treatment (plan §14.1; D250, D251), from the status its sheet
 * read: **Start**, **Resume** and **Put on hold** at a tap; **Complete** and
 * **Cancel** asking first, as nothing brings them back (AGENTS.md §23) — a
 * cancellation with its reason, or none. Done, `onDone` closes the sheet, the
 * card says so, and the visit, the summary and the history are read again.
 */
export function useTreatmentStatus(treatment: Treatment, visitId: string | null, onDone: () => void) {
  const respond = useResponse();
  const change = useApiMutation(TreatmentsClient.setStatus, {
    revalidate: treatmentRoutes(treatment.patientId, visitId),
    onSuccess: ({ status }) => {
      onDone();
      respond.success({ title: words.moved[status as keyof typeof words.moved](treatment.name) });
    },
    onError: (failure) => respond.failure(failure, { title: words.notChanged }),
  });
  const submit = (move: StatusMove, reason: string | null = null) =>
    change.submit({ id: treatment.id, input: { status: MOVE_STATUS[move], seen: treatment.status, reason } });

  return {
    submitting: change.submitting,
    move: async (move: StatusMove) => {
      if (move === "COMPLETE") {
        const sure = await respond.confirm({
          title: words.completeTitle(treatment.name),
          message: words.completeBody,
          confirmLabel: words.complete,
          confirmIcon: CheckCheck,
        });
        if (!sure) return;
      }
      await submit(move);
    },
    cancel: async (reason: string | null) => {
      const sure = await respond.confirm({
        title: words.cancelTitle(treatment.name),
        message: words.cancelBody(reason),
        confirmLabel: words.cancel,
        confirmIcon: Ban,
        cancelLabel: words.keep,
        tone: "danger",
      });
      if (sure) return (await submit("CANCEL", reason)) !== undefined;
      return false;
    },
  };
}
