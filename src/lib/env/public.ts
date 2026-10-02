/**
 * What the browser may know of the environment: Next writes `NEXT_PUBLIC_*`
 * values into the page when it is built.
 */
export function publicAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

/** The app's version, which the build takes from package.json (next.config.ts). */
export function publicAppVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION ?? "";
}
