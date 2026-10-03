/** The session a link in an email lands with: confirming the email, choosing a new password. */
export interface LinkTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * What Supabase put in the address's fragment as it sent the browser on from
 * a link (ported from Brio): the session's tokens, or — for a link used twice
 * or too late — an error instead. Neither reaches the server's logs: a
 * fragment is never sent with a request.
 */
export function readLinkTokens(fragment: string): { tokens: LinkTokens } | { tokens: null; expired: boolean } {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) return { tokens: { accessToken, refreshToken } };
  return { tokens: null, expired: params.has("error") || params.has("error_code") };
}

/**
 * Takes the link's tokens from the address as the screen opens, and wipes
 * them from it at once: an address in the history holding a session is a
 * session anyone with the device has.
 */
export function takeLinkTokens(): ReturnType<typeof readLinkTokens> {
  const { hash, pathname, search } = window.location;
  const found = readLinkTokens(hash);
  if (hash) window.history.replaceState(null, "", `${pathname}${search}`);
  return found;
}
