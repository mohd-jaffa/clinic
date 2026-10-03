import { withClinicRoute } from "@/features/auth/guard";
import { listTeam } from "@/features/team/api";

export const runtime = "nodejs";

/** The team (plan §8.6): everyone of the clinic, invited and inactive too, for `team.manage`. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "team.manage" }, (tenant) => listTeam(tenant));
}
