import { withClinicRoute } from "@/features/auth/guard";
import { getPrescriptionPdf } from "@/features/documents/api";
import { readQuery } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { documentQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A visit's prescription as a PDF (plan §13, §33; D221): made when it is
 * asked for, for whoever reads visits — a doctor their own patients' (D3) —
 * view-only clinics included. Opened to print, or `?download=1` to save.
 */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "visits.view" }, async (context) =>
    getPrescriptionPdf(context, (await params).id, {
      ...readQuery(request, documentQuerySchema),
      requestId: context.requestId,
    }),
  );
}
