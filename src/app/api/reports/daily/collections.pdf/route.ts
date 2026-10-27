import { withClinicRoute } from "@/features/auth/guard";
import { getCollectionsPdf } from "@/features/documents/api";
import { readQuery } from "@/lib/api/handler";
import { collectionsPdfQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A day's collections as a PDF (plan §18; D49, D359): made when it is asked
 * for, for `reports.view` — view-only clinics included. Opened to print, or
 * `&download=1` to save.
 */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "reports.view" }, (context) =>
    getCollectionsPdf(context, { ...readQuery(request, collectionsPdfQuerySchema), requestId: context.requestId }),
  );
}
