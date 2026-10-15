"use client";

import { useCatalogueChange } from "@/features/clinic/hooks/useCatalogueChange";
import { apiRoutes } from "@/lib/query/keys";

import { TemplatesClient } from "../api.client";
import type { PrescriptionTemplate } from "../types";

/**
 * Archiving a template — asked first — and restoring one (D242), as a
 * catalogue's entries are (D80): a restore into a name in use is refused in
 * the API's words (D243).
 */
export function useTemplateChange() {
  return useCatalogueChange<PrescriptionTemplate>({
    change: ({ id, active }) => TemplatesClient.change({ id, input: { active: active === true } }),
    list: apiRoutes.prescriptionTemplates.list,
  });
}
