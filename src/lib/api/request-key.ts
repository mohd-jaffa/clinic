/**
 * A fresh idempotency key (plan §15.2): a version-4 UUID. `crypto.randomUUID`
 * exists only in a secure context, and the app is also opened over plain http
 * on a local network while it is developed, so the key is built from
 * `getRandomValues`, which exists everywhere.
 */
export function newRequestKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Which key a request goes with. The same request sent again — a double tap,
 * Try again after a dropped connection — goes with the same key, so the server
 * makes one record; a changed request, or one sent after the last succeeded,
 * gets a new one.
 */
export function requestKeys() {
  let last: { request: string; key: string } | null = null;
  return {
    keyFor(payload: unknown): string {
      const request = JSON.stringify(payload);
      if (last?.request !== request) last = { request, key: newRequestKey() };
      return last.key;
    },
    /** The request succeeded: the next one, even if identical, is new. */
    settle() {
      last = null;
    },
  };
}
