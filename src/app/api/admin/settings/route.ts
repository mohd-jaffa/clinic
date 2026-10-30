import { getConsoleSettings } from "@/features/admin/api";
import { withDevRoute } from "@/features/auth/guard";
import { readJson } from "@/lib/api/handler";
import { updatePlatformSettings } from "@/lib/platform/settings";
import { platformSettingsSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** The platform settings (plan §20.4), and who last changed them — the DEV's alone. */
export async function GET(request: Request) {
  return withDevRoute(request, ({ admin }) => getConsoleSettings(admin));
}

/**
 * Change some settings (plan §6; D378): each within its bounds, with the
 * DEV's own client, so the database checks the role and the bounds again and
 * writes the platform audit row. Answers with every setting as saved.
 */
export async function PATCH(request: Request) {
  return withDevRoute(request, async ({ supabase, requestId }) =>
    updatePlatformSettings(supabase, await readJson(request, platformSettingsSchema), requestId),
  );
}
