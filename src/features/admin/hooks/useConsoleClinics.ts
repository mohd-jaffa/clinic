"use client";

import type { ConsoleClinicFilter } from "@/constants/statuses";
import { useApiPages } from "@/lib/query/useApiPages";

import { consoleClinicsKey } from "../keys";
import type { ConsoleClinic } from "../types";

/**
 * A page at a time of every clinic (plan §20.2; D371), searched and kept to
 * one filter. Each filter is its own list: a search keeps its rows on screen
 * until its own come, another filter never shows them (D191).
 */
export function useConsoleClinics(search: string, filter: ConsoleClinicFilter | null) {
  return useApiPages<ConsoleClinic>(consoleClinicsKey(search, filter), { list: filter ?? "ALL" });
}
