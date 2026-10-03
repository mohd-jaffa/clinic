import { withClinicRoute } from "@/features/auth/guard";
import { getMember, updateMember } from "@/features/team/members";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { updateMemberSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A member, with their mobile and a doctor's details (plan §8.6), for `team.manage`. */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "team.manage" }, async (tenant) => getMember(tenant, (await params).id));
}

/** Their access, job title or doctor's details (plan §8.6, D93), for `team.manage`. */
export async function PATCH(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "team.manage" }, async (context) =>
    updateMember(context, (await params).id, await readJson(request, updateMemberSchema), context.requestId),
  );
}
