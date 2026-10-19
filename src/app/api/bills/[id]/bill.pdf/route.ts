import { withClinicRoute } from "@/features/auth/guard";
import { getBillPdf } from "@/features/documents/api";
import { readQuery } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { documentQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A bill as a PDF (plan §15.5; D315, D316): made when it is asked for, for
 * whoever reads bills — a doctor their own patients' (D3) — view-only
 * clinics included. Opened to print, or `?download=1` to save.
 */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "payments.view" }, async (context) =>
    getBillPdf(context, (await params).id, {
      ...readQuery(request, documentQuerySchema),
      requestId: context.requestId,
    }),
  );
}
