import * as z from "zod";

import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { monthStartKey, todayKey } from "@/lib/dates/calendar";

import { requiredDay } from "../primitives";

const { reports: words } = UI_TEXT;

/** A report's day: today or a day before it. */
const reportDay = requiredDay(words.dayLabel).refine((day) => day <= todayKey(), {
  message: VALIDATION_MESSAGES.notAfterToday(words.dayLabel),
});

/** A day's report (plan §18; D356): today or a day before it. */
export const dailyReportQuerySchema = z.object({ day: reportDay });

export type DailyReportQuery = z.output<typeof dailyReportQuerySchema>;

/** A month's report (plan §18): any day of it, read as its first; this month or one before. */
export const monthlyReportQuerySchema = z.object({
  month: requiredDay(words.monthLabel)
    .transform(monthStartKey)
    .refine((month) => month <= monthStartKey(todayKey()), {
      message: VALIDATION_MESSAGES.notAfterToday(words.monthLabel),
    }),
});

export type MonthlyReportQuery = z.output<typeof monthlyReportQuerySchema>;

/** A day's collections as a PDF (D49, D359): its day, and whether it is saved rather than opened. */
export const collectionsPdfQuerySchema = z
  .object({ day: reportDay, download: z.literal("1", { error: VALIDATION_MESSAGES.invalid }).optional() })
  .transform(({ day, download }) => ({ day, download: download === "1" }));

export type CollectionsPdfQuery = z.output<typeof collectionsPdfQuerySchema>;
