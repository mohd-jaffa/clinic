"use client";

import { useApiQuery } from "@/lib/query/useApiQuery";

import { templatesKey } from "../keys";
import type { PrescriptionTemplate } from "../types";

/**
 * A doctor's prescription templates, archived ones too, by name (D241,
 * D242) — asked only once there is a doctor to ask for: the Templates sheet
 * asks once it is first opened.
 */
export function useTemplates(doctorId: string | null) {
  return useApiQuery<PrescriptionTemplate[]>(doctorId ? templatesKey(doctorId) : null);
}
