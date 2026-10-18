"use client";

import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { useClinic } from "@/features/clinic/hooks/useClinic";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";

/**
 * Whether an arrival goes on to **Collect fee** (plan §11.3; D283, D305): in
 * a clinic that collects the consultation fee at arrival, for whoever may
 * issue a bill, while the clinic may write.
 */
export function useFeeAtArrival(): boolean {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const clinic = useClinic().data;
  return (
    clinic?.feeTiming === "AT_ARRIVAL" && membership !== null && hasAccess(membership, "payments.create") && !readOnly
  );
}
