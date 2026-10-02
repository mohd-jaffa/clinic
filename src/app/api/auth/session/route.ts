import { requireSession } from "@/features/auth/guard";
import { toSessionView } from "@/features/auth/session";
import { withApiHandler } from "@/lib/api/handler";

export const runtime = "nodejs";

/**
 * Who is signed in, their membership and their clinic's plan (plan §5.5) —
 * never a token, which stays in the HttpOnly cookies (AGENTS.md §9).
 */
export async function GET(request: Request) {
  return withApiHandler(request, async () => toSessionView(await requireSession(request)));
}
