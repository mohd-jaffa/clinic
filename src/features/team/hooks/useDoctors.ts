"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { Doctor } from "../types";

/** The clinic's active doctors, by name, for a picker (plan §30). */
export function useDoctors() {
  return useApiQuery<Doctor[]>(apiRoutes.doctors.list);
}
