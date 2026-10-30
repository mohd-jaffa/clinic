import * as z from "zod";

import { VALIDATION_MESSAGES } from "@/constants/messages";
import { ACTIVITY_KINDS } from "@/constants/statuses";

import { cursorParam } from "./list";

/** The owner's activity log (plan §19; D388): one person's, one kind's, or both; and where the page starts. */
export const activityQuerySchema = z.object({
  person: z.uuid({ error: VALIDATION_MESSAGES.invalid }).optional(),
  kind: z.enum(ACTIVITY_KINDS, { error: VALIDATION_MESSAGES.invalid }).optional(),
  cursor: cursorParam,
});

export type ActivityQuery = z.output<typeof activityQuerySchema>;
