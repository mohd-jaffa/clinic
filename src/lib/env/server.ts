import * as z from "zod";

import { internalError } from "@/lib/errors";

/**
 * Everything the server reads from its environment, checked once (plan §35):
 * a missing or malformed value stops the request with `CONFIG_INVALID` rather
 * than failing somewhere deeper with a stranger message. `.env.example` lists
 * exactly these; later phases add mail (Phase 1), `CRON_SECRET` and
 * `TRIAL_CLAIM_SECRET` here as they are needed.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
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
