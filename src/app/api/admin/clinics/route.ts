import { withDevRoute } from "@/features/auth/guard";
import { listConsoleClinics } from "@/features/admin/api";
import { readQuery } from "@/lib/api/handler";
import { consoleClinicsQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A page of every clinic (plan §20.2; D371): searched, filtered, the newest sign-up first — the DEV's alone. */
export async function GET(request: Request) {
  return withDevRoute(request, ({ admin }) => listConsoleClinics(admin, readQuery(request, consoleClinicsQuerySchema)));
}
