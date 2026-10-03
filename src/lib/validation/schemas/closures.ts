import * as z from "zod";

import { MAX_CLOSURE_DAYS, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { dayCount, todayKey } from "@/lib/dates/calendar";

import { requiredDay, requiredLine } from "../primitives";

const { closures } = UI_TEXT;
const chooseWho = VALIDATION_MESSAGES.choose(closures.whoLabel);

/** What the form's **Who's away** holds for the whole clinic, rather than one doctor's id. */
export const WHOLE_CLINIC = "CLINIC";

/**
 * A holiday or a doctor's leave (plan §9, D85): who is away — the whole
 * clinic or one doctor — from which day to which, and why. It starts today or
 * later, ends on or after its first day, and lasts at most a year; the
 * database holds the same (0011). The whole clinic arrives as no doctor.
 */
export const closureSchema = z
  .object({
    who: z.union([z.literal(WHOLE_CLINIC), z.uuid({ error: chooseWho })], { error: chooseWho }),
    startsOn: requiredDay(closures.firstDayLabel),
    endsOn: requiredDay(closures.lastDayLabel),
    reason: requiredLine(closures.reasonLabel, { max: TEXT_LIMITS.closureReason }),
  })
  .superRefine(({ startsOn, endsOn }, ctx) => {
    if (startsOn < todayKey()) {
      ctx.addIssue({
        code: "custom",
        path: ["startsOn"],
        message: VALIDATION_MESSAGES.notBeforeToday(closures.firstDayLabel),
      });
    }
    if (endsOn < startsOn) {
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: VALIDATION_MESSAGES.endsBeforeStart(closures.lastDayLabel, closures.firstDayLabel),
      });
    } else if (dayCount(startsOn, endsOn) > MAX_CLOSURE_DAYS) {
      ctx.addIssue({ code: "custom", path: ["endsOn"], message: VALIDATION_MESSAGES.atMostDays(MAX_CLOSURE_DAYS) });
    }
  })
  .transform(({ who, ...closure }) => ({ ...closure, doctorId: who === WHOLE_CLINIC ? null : who }));

export type ClosureInput = z.input<typeof closureSchema>;
export type ClosurePayload = z.output<typeof closureSchema>;
