import { deleteJson, patchJson, postFile } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { UpdateClinicInput } from "@/lib/validation";

import type { ClinicProfile } from "./types";

/** The clinic endpoints the browser calls (plan §9, §30). Each answers with the clinic as it now is. */
export const ClinicClient = {
  /** Its details, its paper size or its fee timing, each on its own (D78). */
  update: (payload: UpdateClinicInput) => patchJson<ClinicProfile>(apiRoutes.clinic.profile, payload),

  /** A new logo: the file itself, checked again by the server (AGENTS.md §20). */
  uploadLogo: (file: File) => postFile<ClinicProfile>(apiRoutes.clinic.logo, file),

  /** No logo (D79). */
  removeLogo: () => deleteJson<ClinicProfile>(apiRoutes.clinic.logo),
};
