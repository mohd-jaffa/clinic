import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Two projects (plan §34, AGENTS.md §31):
 *
 *   unit         tests/ except the integration and browser suites, in jsdom
 *                (`npm test`)
 *   integration  the app's data functions against the local Supabase with
 *                every migration applied (`npm run db:start`;
 *                `npm run test:integration`); tests/support/local-supabase.ts
 *                refuses any other database
 *
 * `npm run test:coverage` runs both and fails below 100% (D16). Pages and
 * layouts are composition only and are covered by the browser journeys.
 */
const local = { ...loadEnv("test", process.cwd(), ""), ...process.env };

const alias = {
  "@tests": path.resolve(__dirname, "./tests"),
  "@": path.resolve(__dirname, "./src"),
};

export default defineConfig({
  test: {
    alias,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/app/**/layout.tsx", "src/app/**/page.tsx", "src/instrumentation.ts"],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./tests/support/setup.ts"],
          // Every test lives under tests/: unit/ mirrors src/, db/ and contract/
          // hold what belongs to no one module. src/ holds only what ships.
          include: ["tests/**/*.test.{ts,tsx}"],
          exclude: ["tests/db/integration/**", "tests/e2e/**", "**/node_modules/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/db/integration/**/*.test.ts"],
          globalSetup: ["./tests/support/local-supabase.ts"],
          env: {
            NEXT_PUBLIC_SUPABASE_URL: local.NEXT_PUBLIC_SUPABASE_URL ?? "",
            NEXT_PUBLIC_SUPABASE_ANON_KEY: local.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
            SUPABASE_SERVICE_ROLE_KEY: local.SUPABASE_SERVICE_ROLE_KEY ?? "",
            NEXT_PUBLIC_APP_URL: local.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
            SMTP_HOST: local.SMTP_HOST ?? "",
            SMTP_PORT: local.SMTP_PORT ?? "",
            SMTP_SECURE: local.SMTP_SECURE ?? "",
            SMTP_USER: local.SMTP_USER ?? "",
            SMTP_PASSWORD: local.SMTP_PASSWORD ?? "",
            SMTP_FROM: local.SMTP_FROM ?? "",
            TRIAL_CLAIM_SECRET: local.TRIAL_CLAIM_SECRET ?? "",
          },
          // Each file makes its own clinics; one at a time keeps them apart in the logs.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
