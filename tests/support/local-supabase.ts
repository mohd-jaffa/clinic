import { loadEnv } from "vite";

/** A Supabase on this machine: the only database the integration tests and the journeys may touch. */
export const LOCAL_SUPABASE = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/;

/**
 * The integration project's global setup (plan §34.3): the tests make and
 * delete clinics of their own, so they may run against a database in use —
 * but only a local one. A hosted address, or none, stops the run before any
 * test starts.
 */
export default function refuseHostedSupabase(): void {
  const env = { ...loadEnv("test", process.cwd(), ""), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!LOCAL_SUPABASE.test(url)) {
    throw new Error(`Integration tests run only against a local Supabase, not ${url || "an unset address"}.`);
  }
}
