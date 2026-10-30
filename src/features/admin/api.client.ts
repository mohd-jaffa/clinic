import type { PlatformSettings } from "@/constants/platform";
import { patchJson, postOnce } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { ExtendPlanInput, PlatformSettingsInput } from "@/lib/validation";

import type { PlanExtended } from "./types";

/**
 * The console's writes the browser calls (plan §30): Extend plan, once per
 * key however often it is sent; and the settings changed.
 */
export const ConsoleClient = {
  extend: ({ clinicId, input, key }: { clinicId: string; input: ExtendPlanInput; key: string }) =>
    postOnce<PlanExtended>(apiRoutes.console.extend(clinicId), input, key),
  saveSettings: (changes: PlatformSettingsInput) => patchJson<PlatformSettings>(apiRoutes.console.settings, changes),
};
