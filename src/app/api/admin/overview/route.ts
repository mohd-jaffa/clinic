import { withDevRoute } from "@/features/auth/guard";
import { getConsoleOverview } from "@/features/admin/api";

export const runtime = "nodejs";

/** The console's Overview (plan §20.1; D368), the DEV's alone. */
export async function GET(request: Request) {
  return withDevRoute(request, ({ admin }) => getConsoleOverview(admin));
}
