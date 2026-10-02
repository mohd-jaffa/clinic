import { updateProfile } from "@/features/auth/account";
import { withAccountRoute } from "@/features/auth/guard";
import { readJson } from "@/lib/api/handler";
import { updateProfileSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** My account's name and mobile (plan §5.4). */
export async function PATCH(request: Request) {
  return withAccountRoute(request, {}, async ({ session, admin }) =>
    updateProfile(admin, session, await readJson(request, updateProfileSchema)),
  );
}
