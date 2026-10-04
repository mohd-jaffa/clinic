import { apiRoutes, withQuery } from "@/lib/query/keys";
import type { PatientTab } from "@/lib/validation";

/**
 * The patients list's key (plan §10.2): the list the page arrives with is the
 * one asked for with nothing searched. Held in memory only — each page goes
 * as a POST (D98).
 */
export const patientsKey = (search: string, tab: PatientTab) => withQuery(apiRoutes.patients.search, { search, tab });
