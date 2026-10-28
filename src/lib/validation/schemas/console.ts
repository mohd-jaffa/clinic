import * as z from "zod";

import { VALIDATION_MESSAGES } from "@/constants/messages";
import { CONSOLE_CLINIC_FILTERS } from "@/constants/statuses";

import { cursorParam, searchParam } from "./list";

/** The console's Clinics list (plan §20.2): what was typed, one filter, and where the page starts. */
export const consoleClinicsQuerySchema = z.object({
  search: searchParam,
  filter: z.enum(CONSOLE_CLINIC_FILTERS, { error: VALIDATION_MESSAGES.invalid }).optional(),
  cursor: cursorParam,
});

export type ConsoleClinicsQuery = z.output<typeof consoleClinicsQuerySchema>;
