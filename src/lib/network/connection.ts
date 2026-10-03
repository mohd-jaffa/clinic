/**
 * Whether the device has a connection (plan §21, D55), as the browser knows
 * it. `navigator.onLine` false means none for certain; true means one may
 * be there — a request can still fail to reach the server, and is retried
 * for a while (`client.ts`). Off the browser — while a page is drawn on the
 * server — it is taken as online.
 */
export function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

/** Calls `listener` whenever the connection drops or comes back; answers how to stop. */
export function onConnectionChange(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** Settles once the device is online: at once if it is, else when the connection comes back. */
export function backOnline(): Promise<void> {
  if (isOnline()) return Promise.resolve();
  return new Promise((resolve) => window.addEventListener("online", () => resolve(), { once: true }));
}

/**
 * How long a write that must happen once waits before going again, each time
 * it fails to reach the server while the device says it is online — a
 * captive Wi-Fi, a server restarting. Once these are spent it gives up and
 * says so; while the device is offline it simply waits for the connection.
 */
export const NETWORK_RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;
