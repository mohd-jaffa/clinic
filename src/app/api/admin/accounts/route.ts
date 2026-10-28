import { withDevRoute } from "@/features/auth/guard";
import { listConsoleAccounts } from "@/features/admin/api";
import { readQuery } from "@/lib/api/handler";
import { listQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A page of every account (plan §20.5), the newest first — the DEV's alone. */
export async function GET(request: Request) {
  return withDevRoute(request, ({ admin }) => listConsoleAccounts(admin, readQuery(request, listQuerySchema)));
}
