import * as z from "zod";

import { MAX_CLOSURE_DAYS, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { dayCount, todayKey } from "@/lib/dates/calendar";

import { requiredDay, requiredLine } from "../primitives";

const { closures } = UI_TEXT;
const chooseWho = VALIDATION_MESSAGES.choose(closures.whoLabel);

/** What the form's **Who's away** holds for the whole clinic, rather than one doctor's id. */
export const WHOLE_CLINIC = "CLINIC";

const who = z.union([z.literal(WHOLE_CLINIC), z.uuid({ error: chooseWho })], { error: chooseWho });

/**
 * A closure's days (D85): it starts today or later, ends on or after its
 * first day, and lasts at most a year; the database holds the same (0011).
 */
function checkDays({ startsOn, endsOn }: { startsOn: string; endsOn: string }, ctx: z.RefinementCtx) {
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
}

/** The whole clinic arrives as no doctor. */
function toDoctor<T extends { who: string }>({ who: away, ...rest }: T) {
  return { ...rest, doctorId: away === WHOLE_CLINIC ? null : away };
}

/**
 * A holiday or a doctor's leave (plan §9, D85): who is away — the whole
 * clinic or one doctor — from which day to which, and why.
 */
export const closureSchema = z
  .object({
    who,
    startsOn: requiredDay(closures.firstDayLabel),
    endsOn: requiredDay(closures.lastDayLabel),
    reason: requiredLine(closures.reasonLabel, { max: TEXT_LIMITS.closureReason }),
  })
  .superRefine(checkDays)
  .transform(toDoctor);

export type ClosureInput = z.input<typeof closureSchema>;
export type ClosurePayload = z.output<typeof closureSchema>;

/**
 * The days of a closure being added, as its sheet holds them (D137): who is
 * away and from which day to which — asked before it is saved, for the
 * appointments already on those days.
 */
export const closureDaysSchema = z
  .object({ who, startsOn: requiredDay(closures.firstDayLabel), endsOn: requiredDay(closures.lastDayLabel) })
  .superRefine(checkDays)
  .transform(toDoctor);

export type ClosureDaysInput = z.input<typeof closureDaysSchema>;
export type ClosureDaysPayload = z.output<typeof closureDaysSchema>;
