import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

/**
 * The browser journeys (plan §34, AGENTS.md §31): the built app, at a phone's
 * width and a desktop's, against the local Supabase.
 *
 *   npm run build && npm run test:e2e
 *
 * The app is served by `next start` on its own port. Journeys make their own
 * clinics and delete them after, so they may run against a database in use —
 * but only a local one, and with no mail sent.
 */
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(supabaseUrl)) {
  throw new Error(`The journeys run only against a local Supabase, not ${supabaseUrl || "an unset address"}.`);
}
for (const name of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "SMTP_SECURE"]) {
  process.env[name] = "";
}

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Mobile first, desktop just as well (PRODUCT.md): every journey runs at both.
  projects: [
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
