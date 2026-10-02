import { createHmac } from "node:crypto";

/**
 * What `trial_claims` keeps of an owner's mobile (plan §7.6, §27.6): an
 * HMAC-SHA256 of the E.164 number keyed by TRIAL_CLAIM_SECRET — the same
 * number always gives the same value, and the value never gives the number
 * back. Only the server computes it.
 */
export function mobileHmac(e164: string, secret: string): string {
  return createHmac("sha256", secret).update(e164).digest("hex");
}
