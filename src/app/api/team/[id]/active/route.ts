import { withClinicRoute } from "@/features/auth/guard";
import { setMemberActive } from "@/features/team/members";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { memberActiveSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Deactivates or reactivates a member (plan §8.6), for `team.manage`. */
export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "team.manage" }, async (context) => {
    const { active } = await readJson(request, memberActiveSchema);
    return setMemberActive(context, (await params).id, active, context.requestId);
  });
}
