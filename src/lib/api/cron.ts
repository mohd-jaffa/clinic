import { createHash, timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env/server";
import { authenticationError } from "@/lib/errors";

const digest = (text: string) => createHash("sha256").update(text).digest();

/**
 * Lets through only the database's scheduler (plan §22): a bearer token equal
 * to CRON_SECRET, compared in constant time. With no secret set, no one.
 */
export function requireCronSecret(request: Request, secret = getServerEnv().CRON_SECRET): void {
  const [scheme, token] = (request.headers.get("authorization") ?? "").split(" ");
  const allowed = secret !== undefined && scheme?.toLowerCase() === "bearer" && Boolean(token);
  if (!allowed || !timingSafeEqual(digest(token), digest(secret))) throw authenticationError("CRON_SECRET_INVALID");
}
