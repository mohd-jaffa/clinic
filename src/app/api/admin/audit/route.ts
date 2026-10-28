import { withDevRoute } from "@/features/auth/guard";
import { listConsoleAudit } from "@/features/admin/api";
import { readQuery } from "@/lib/api/handler";
import { pageQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A page of the platform audit (plan §20.7), the latest first — the DEV's alone. */
export async function GET(request: Request) {
  return withDevRoute(request, ({ admin }) => listConsoleAudit(admin, readQuery(request, pageQuerySchema)));
}
