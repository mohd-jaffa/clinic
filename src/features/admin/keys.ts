import { CONSOLE_CLINIC_FILTERS, type ConsoleClinicFilter } from "@/constants/statuses";
import { apiRoutes, withQuery } from "@/lib/query/keys";

/** The Clinics list's key (plan §20.2): what was typed and its filter, as the route reads them. */
export const consoleClinicsKey = (search: string, filter: ConsoleClinicFilter | null) =>
  withQuery(apiRoutes.console.clinics, { search, filter });

/** The filter an address names — the Overview's figures lead to the list with one — or none for anything else. */
export const clinicFilterOf = (asked: string | null | undefined): ConsoleClinicFilter | null =>
  CONSOLE_CLINIC_FILTERS.find((filter) => filter === asked) ?? null;
