import type { SupabaseClient } from "@supabase/supabase-js";

import type { Permission } from "@/constants/permissions";
import type { ClinicRole } from "@/constants/roles";

/**
 * Who is acting, for which clinic, through which client (plan §27.1). Every
 * feature's data functions take this, never `(client, clinicId)`; a route
 * builds it from the session (`withClinicRoute`), never from anything the
 * request says.
 */
export interface Tenant {
  /** Carries the caller's token: every read and write runs under their RLS policies. */
  supabase: SupabaseClient;
  clinicId: string;
  /** The signed-in user acting, for the audit trail and every *_by column. */
  actorId: string;
  memberId: string;
  role: ClinicRole;
  /** What the member may do; the owner's are all of them (plan §8.2). */
  permissions: readonly Permission[];
  /** Their doctor profile, while it is active; null for anyone who is not a doctor. */
  doctorId: string | null;
}
