import { withDevRoute } from "@/features/auth/guard";
import { getConsoleClinic } from "@/features/admin/api";
import type { RouteParams } from "@/lib/api/params";

export const runtime = "nodejs";

/** One clinic's page in the console (plan §20.3): its row and its plan's history — the DEV's alone. */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withDevRoute(request, async ({ admin }) => getConsoleClinic(admin, (await params).id));
}
