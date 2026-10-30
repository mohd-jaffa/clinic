import { withApiHandler } from "@/lib/api/handler";
import { getPublicPricing } from "@/lib/platform/pricing";

export const runtime = "nodejs";

/**
 * The free trial, the two prices and the renewal contact (plan §21, §30), as
 * the DEV last saved them — open to anyone, signed in or not, and nothing
 * else of the platform settings.
 */
export async function GET(request: Request) {
  return withApiHandler(request, () => getPublicPricing());
}
