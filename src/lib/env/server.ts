import * as z from "zod";

import { internalError } from "@/lib/errors";

/** Unset and blank are the same thing in an env file. */
const blankAsMissing = (value: unknown) => (value === "" ? undefined : value);

const optionalString = z.preprocess(blankAsMissing, z.string().trim().min(1).optional());

const optionalPort = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : Number(value)),
  z.number().int().min(1).max(65535).optional(),
);

const optionalBoolean = z.preprocess((value) => {
  if (value === "" || value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean().optional());

/**
 * Everything the server reads from its environment, checked once (plan §35):
 * a missing or malformed value stops the request with `CONFIG_INVALID` rather
 * than failing somewhere deeper with a stranger message. `.env.example` lists
 * exactly these; `CRON_SECRET` joins them with the plan emails (Phase 11).
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // The app's own mail (plan §22): Mailpit locally, Gmail first in production
  // (D20). Unset, mail is off and every send says so; nothing it was for is undone.
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalPort,
  SMTP_SECURE: optionalBoolean,
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM: optionalString,

  // The key of the HMAC that remembers which mobiles have had a trial (plan
  // §7.6). Changing it forgets every claim, so it is set once and kept.
  TRIAL_CLAIM_SECRET: z.string().min(32),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  // Operators read these, not clinics: keep Zod's own detail here, ahead of
  // the app-wide catalogue wording set in src/lib/validation/primitives.ts.
  const parsed = serverEnvSchema.safeParse(source, { error: (issue) => z.config().localeError?.(issue) });

  if (!parsed.success) {
    throw internalError(
      "CONFIG_INVALID",
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}
