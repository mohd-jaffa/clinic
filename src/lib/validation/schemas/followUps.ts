import * as z from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { FOLLOW_UP_KINDS, FOLLOW_UP_OUTCOMES, FOLLOW_UP_TABS } from "@/constants/statuses";

import { optionalDay, optionalLine } from "../primitives";
import { cursorParam } from "./list";

const { followUps: words } = UI_TEXT;

/** A page of one of the follow-ups' tabs (plan §14.3): which tab, and where the page starts. */
export const followUpListQuerySchema = z.object({
  tab: z.enum(FOLLOW_UP_TABS, { error: VALIDATION_MESSAGES.invalid }),
  cursor: cursorParam,
});

export type FollowUpListQuery = z.output<typeof followUpListQuerySchema>;

/**
 * A contact noted (plan §14.3; D271, D273, D274): which follow-up — a
 * treatment's next sitting or a visit's follow-up, by its id — how it went,
 * a note, and a day to be reminded on, or none.
 */
export const followUpContactSchema = z.object({
  kind: z.enum(FOLLOW_UP_KINDS, { error: VALIDATION_MESSAGES.invalid }),
  id: z.uuid({ error: VALIDATION_MESSAGES.invalid }),
  outcome: z.enum(FOLLOW_UP_OUTCOMES, { error: VALIDATION_MESSAGES.choose(words.outcomeLabel) }),
  note: optionalLine(words.noteLabel, TEXT_LIMITS.contactNote),
  snoozeUntil: optionalDay(words.remindMeLabel),
});

export type FollowUpContactInput = z.input<typeof followUpContactSchema>;
export type FollowUpContactPayload = z.output<typeof followUpContactSchema>;

/** A contact as its form checks it: a day to be reminded on is after today, as the database holds it (0026). */
export const followUpContactFormSchema = (today: string) =>
  followUpContactSchema.superRefine(({ snoozeUntil }, ctx) => {
    if (snoozeUntil !== null && snoozeUntil <= today) {
      ctx.addIssue({
        code: "custom",
        path: ["snoozeUntil"],
        message: VALIDATION_MESSAGES.afterToday(words.remindMeLabel),
      });
    }
  });
