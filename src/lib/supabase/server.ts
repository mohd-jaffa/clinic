import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env/server";

/** The server holds no Supabase session of its own: every client is made for one request and forgotten. */
const sharedAuthOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};

/**
 * A client that acts as the person whose token it carries, so every read and
 * write runs under their RLS policies (AGENTS.md §7) — or, with no token, as
 * nobody: what signing in and refreshing use.
 */
export function createSupabaseAnonClient(accessToken?: string) {
  const env = getServerEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: sharedAuthOptions,
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

/**
 * The server's own client, which RLS does not bind (plan §27.5). Only for
 * registration, invites, audit and error-log writes, platform settings, the
 * developer console, the cron route, clinic deletion and the logo — never a
 * feature function acting for a clinic member.
 */
export function createSupabaseServiceRoleClient() {
  const env = getServerEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: sharedAuthOptions,
  });
}
