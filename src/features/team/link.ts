/**
 * Takes an invite's token from the address as the accept screen opens, and
 * wipes it from the address at once (D63): it rides in the fragment, which
 * is never sent to a server, and an address in the history holding it is an
 * invite anyone with the device has.
 */
export function takeInviteToken(): string | null {
  const { hash, pathname, search } = window.location;
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("token");
  if (hash) window.history.replaceState(null, "", `${pathname}${search}`);
  return token;
}
