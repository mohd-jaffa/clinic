import { withDevRoute } from "@/features/auth/guard";
import { getConsoleReceiptPdf } from "@/features/documents/api";
import { readQuery } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { documentQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A plan payment's receipt for the DEV (D395), to send the owner a copy: the platform's own record. */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withDevRoute(request, async ({ admin, requestId }) =>
    getConsoleReceiptPdf(admin, (await params).id, { ...readQuery(request, documentQuerySchema), requestId }),
  );
}
