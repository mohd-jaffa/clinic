import { ROUTE_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { getPlanReceiptPdf } from "@/features/documents/api";
import { readQuery } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { documentQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A plan payment's receipt as a PDF (plan §7.5; D58, D392, D393): the
 * owner's, made when it is asked for — a view-only clinic's too. Opened to
 * print, or `?download=1` to save.
 */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.owner }, async (context) =>
    getPlanReceiptPdf(context, context.session.profile.fullName, (await params).id, {
      ...readQuery(request, documentQuerySchema),
      requestId: context.requestId,
    }),
  );
}
