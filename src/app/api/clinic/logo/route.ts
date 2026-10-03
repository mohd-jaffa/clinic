import { ROUTE_ACCESS } from "@/constants/permissions";
import { MAX_LOGO_BYTES } from "@/constants/uploads";
import { readLogo, removeLogo, replaceLogo } from "@/features/clinic/api";
import { logoResponse } from "@/features/clinic/logo";
import { withClinicRoute } from "@/features/auth/guard";
import { readBody } from "@/lib/api/handler";

export const runtime = "nodejs";

/** The clinic's logo, for its own members only (plan §28.8). */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.member }, async (context) => {
    const { file, type } = await readLogo(context);
    return logoResponse(file, { type, requestId: context.requestId });
  });
}

/** A new logo, the file itself as the body: PNG, JPEG or WebP, at most 500 KB (AGENTS.md §20). */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "settings.manage" }, async (context) =>
    replaceLogo(
      context,
      await readBody(request, { maxBytes: MAX_LOGO_BYTES, tooLarge: "LOGO_TOO_LARGE" }),
      context.requestId,
    ),
  );
}

/** No logo (D79). */
export async function DELETE(request: Request) {
  return withClinicRoute(request, { access: "settings.manage" }, async (context) =>
    removeLogo(context, context.requestId),
  );
}
