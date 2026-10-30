import type { RouteParams } from "@/lib/api/params";
import { apiRoutes } from "@/lib/query/keys";

/**
 * A receipt from its email (D394): a screen's address, so someone signed
 * out is sent to sign in and brought back here; then on to the PDF itself,
 * which the owner's session opens.
 */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return Response.redirect(new URL(apiRoutes.subscription.receipt((await params).id), request.url), 303);
}
