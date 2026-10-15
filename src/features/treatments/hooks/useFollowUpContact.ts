"use client";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { FOLLOW_UP_OUTCOME_LABELS } from "@/constants/statuses";
import { formatDayMonth } from "@/lib/format/date";
import { useApiMutation } from "@/lib/query/useApiMutation";
import type { FollowUpContactInput } from "@/lib/validation";

import { FollowUpsClient } from "../api.client";
import { FOLLOW_UP_ROUTES } from "../keys";
import type { FollowUp } from "../types";

const { followUps: words } = UI_TEXT;

/** A contact as its form sends it: everything but which follow-up it is about. */
export type ContactForm = Omit<FollowUpContactInput, "kind" | "id">;

/**
 * **Mark contacted** (plan §14.3; D271, D274): the contact noted, every tab
 * and its count read again — one snoozed leaves its list — then `onDone`
 * closes what it was noted from, and a card says whose and how it went, and,
 * snoozed, the day it is back.
 */
export function useFollowUpContact(followUp: FollowUp, onDone: () => void) {
  const respond = useResponse();
  const noting = useApiMutation(FollowUpsClient.note, {
    revalidate: FOLLOW_UP_ROUTES,
    onSuccess: (noted) => {
      onDone();
      const outcome = FOLLOW_UP_OUTCOME_LABELS[noted.outcome];
      const name = followUp.patient.name;
      respond.success({
        title:
          noted.snoozeUntil === null
            ? words.noted(name, outcome)
            : words.notedUntil(name, outcome, formatDayMonth(noted.snoozeUntil)),
      });
    },
    onError: (failure) => respond.failure(failure, { title: words.notNoted }),
  });
  return {
    save: (contact: ContactForm) => noting.submit({ ...contact, kind: followUp.kind, id: followUp.id }),
    saving: noting.submitting,
  };
}
