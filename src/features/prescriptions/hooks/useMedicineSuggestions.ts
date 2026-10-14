"use client";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { apiRoutes, withQuery } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { PrescriptionItem } from "../types";

/**
 * The medicines this clinic has written that begin with what is typed (D211),
 * each with its line as `doctorId` — else anyone — last wrote it. Asked once
 * the typing settles, and only while a name is being typed: a prescription
 * opened with five medicines on it asks nothing. The last answer stays while
 * the next is asked, so the list does not blink as each key lands.
 */
export function useMedicineSuggestions(typed: string, doctorId: string) {
  const q = useDebouncedValue(typed.trim());
  return useApiQuery<PrescriptionItem[]>(q ? withQuery(apiRoutes.prescriptions.medicines, { q, doctorId }) : null, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
}
