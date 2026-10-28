import { withDevRoute } from "@/features/auth/guard";
import { listConsoleErrors } from "@/features/admin/api";
import { readQuery } from "@/lib/api/handler";
import { pageQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A page of the error log (plan §20.6; D372), the latest first — the DEV's alone. */
export async function GET(request: Request) {
  return withDevRoute(request, ({ admin }) => listConsoleErrors(admin, readQuery(request, pageQuerySchema)));
}
