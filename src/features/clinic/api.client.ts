import { deleteJson, patchJson, postFile, postJson } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { AppointmentTypeInput, ExpenseCategoryInput, ServiceInput, UpdateClinicInput } from "@/lib/validation";

import type { AppointmentType, ClinicProfile, ExpenseCategory, Service } from "./types";

/** The clinic endpoints the browser calls (plan §9, §30). Each answers with the clinic as it now is. */
export const ClinicClient = {
  /** Its details, its paper size or its fee timing, each on its own (D78). */
  update: (payload: UpdateClinicInput) => patchJson<ClinicProfile>(apiRoutes.clinic.profile, payload),

  /** A new logo: the file itself, checked again by the server (AGENTS.md §20). */
  uploadLogo: (file: File) => postFile<ClinicProfile>(apiRoutes.clinic.logo, file),

  /** No logo (D79). */
  removeLogo: () => deleteJson<ClinicProfile>(apiRoutes.clinic.logo),
};

/** One entry of a catalogue to change: its details, or archiving (`false`) or restoring (`true`) it (D80). */
export interface EntryChange<Input> {
  id: string;
  details?: Input;
  active?: boolean;
}

/** A catalogue's endpoints (plan §30): add one, change one. Each answers with the entry as it now is. */
function catalogueClient<Entry, Input>(routes: { list: string; one: (id: string) => string }) {
  return {
    add: (input: Input) => postJson<Entry>(routes.list, input),
    change: ({ id, ...change }: EntryChange<Input>) => patchJson<Entry>(routes.one(id), change),
  };
}

export const ServicesClient = catalogueClient<Service, ServiceInput>(apiRoutes.services);
export const AppointmentTypesClient = catalogueClient<AppointmentType, AppointmentTypeInput>(
  apiRoutes.appointmentTypes,
);
export const ExpenseCategoriesClient = catalogueClient<ExpenseCategory, ExpenseCategoryInput>(
  apiRoutes.expenseCategories,
);
