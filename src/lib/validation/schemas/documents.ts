import * as z from "zod";

import { VALIDATION_MESSAGES } from "@/constants/messages";

/** A document asked for (plan §33): to open and print, or `?download=1` to save (D221). */
export const documentQuerySchema = z
  .object({ download: z.literal("1", { error: VALIDATION_MESSAGES.invalid }).optional() })
  .transform(({ download }) => ({ download: download === "1" }));

export type DocumentQuery = z.output<typeof documentQuerySchema>;
