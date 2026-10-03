import { postJson } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";

/**
 * The authentication endpoints the browser calls. None of them takes or
 * returns a token: the session lives in HttpOnly cookies the browser carries
 * by itself (AGENTS.md §9). The account screens add theirs as they are built.
 */
export const AuthClient = {
  signOut: () => postJson<{ signedOut: boolean }>(apiRoutes.auth.logout),
};
