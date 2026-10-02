import { validationError } from "@/lib/errors";

import { IDEMPOTENCY_HEADER } from "./client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The key a write that must happen once was sent with (plan §15.2). The browser
 * makes one per attempt at a given request and sends it again with any retry,
 * so the server can answer a repeat with what the first made. A write that
 * needs one is refused without it.
 */
export function readIdempotencyKey(request: Request): string {
  const key = request.headers.get(IDEMPOTENCY_HEADER)?.trim() ?? "";
  if (!UUID.test(key)) throw validationError("IDEMPOTENCY_KEY_REQUIRED");
  return key.toLowerCase();
}
