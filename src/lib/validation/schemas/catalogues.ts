import * as z from "zod";

import { APPOINTMENT_MINUTES, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { SERVICE_CATEGORIES } from "@/constants/statuses";

import { paiseText, requiredLine, wholeNumberText } from "../primitives";

const { priceList, appointmentTypes, expenseCategories } = UI_TEXT;

/** A price-list entry (plan §9): its name, its category and its price, typed in rupees. */
export const serviceSchema = z.object({
  name: requiredLine(priceList.nameLabel, { max: TEXT_LIMITS.serviceName }),
  category: z.enum(SERVICE_CATEGORIES, { error: VALIDATION_MESSAGES.choose(priceList.categoryLabel) }),
  price: paiseText(priceList.priceLabel),
});

export type ServiceInput = z.input<typeof serviceSchema>;
export type ServicePayload = z.output<typeof serviceSchema>;

/** An appointment type (plan §9, D32): its name and how long it usually takes. */
export const appointmentTypeSchema = z.object({
  name: requiredLine(appointmentTypes.nameLabel, { max: TEXT_LIMITS.catalogueName }),
  minutes: wholeNumberText(appointmentTypes.minutesLabel, APPOINTMENT_MINUTES),
});

export type AppointmentTypeInput = z.input<typeof appointmentTypeSchema>;
export type AppointmentTypePayload = z.output<typeof appointmentTypeSchema>;

/** An expense category (plan §9, D40): a name. */
export const expenseCategorySchema = z.object({
  name: requiredLine(expenseCategories.nameLabel, { max: TEXT_LIMITS.catalogueName }),
});

export type ExpenseCategoryInput = z.input<typeof expenseCategorySchema>;
export type ExpenseCategoryPayload = z.output<typeof expenseCategorySchema>;

/**
 * A change to one entry (`PATCH /api/<catalogue>/[id]`): its details, or
 * archiving or restoring it (D80) — what is left out stays as it is.
 */
function changeOf<Details extends z.ZodType>(details: Details) {
  return z.object({
    details: details.optional(),
    active: z.boolean().optional(),
  });
}

export const changeServiceSchema = changeOf(serviceSchema);
export const changeAppointmentTypeSchema = changeOf(appointmentTypeSchema);
export const changeExpenseCategorySchema = changeOf(expenseCategorySchema);

export type ChangeServiceInput = z.input<typeof changeServiceSchema>;
export type ChangeServicePayload = z.output<typeof changeServiceSchema>;
export type ChangeAppointmentTypeInput = z.input<typeof changeAppointmentTypeSchema>;
export type ChangeAppointmentTypePayload = z.output<typeof changeAppointmentTypeSchema>;
export type ChangeExpenseCategoryInput = z.input<typeof changeExpenseCategorySchema>;
export type ChangeExpenseCategoryPayload = z.output<typeof changeExpenseCategorySchema>;
