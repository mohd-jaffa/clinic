// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "a-cron-secret-of-at-least-thirty-two-chars";
const env = vi.hoisted(() => ({ current: {} as { CRON_SECRET?: string } }));
vi.mock("@/lib/env/server", () => ({ getServerEnv: () => env.current }));

const { requireCronSecret } = await import("@/lib/api/cron");

const call = (authorization?: string) =>
  new Request("http://localhost/api/cron/subscription-notices", {
    method: "POST",
    headers: authorization === undefined ? {} : { authorization },
  });

beforeEach(() => {
  env.current = { CRON_SECRET: SECRET };
});

describe("requireCronSecret (plan §22)", () => {
  it("lets through a bearer token equal to the secret, whatever the scheme's case", () => {
    expect(() => requireCronSecret(call(`Bearer ${SECRET}`))).not.toThrow();
    expect(() => requireCronSecret(call(`bearer ${SECRET}`))).not.toThrow();
  });

  it("refuses no token, another scheme, and any other token, whatever its length", () => {
    for (const authorization of [undefined, "", `Basic ${SECRET}`, "Bearer", "Bearer wrong", `Bearer ${SECRET}x`]) {
      expect(() => requireCronSecret(call(authorization)), String(authorization)).toThrow(
        expect.objectContaining({ code: "CRON_SECRET_INVALID", kind: "AUTHENTICATION" }),
      );
    }
  });

  it("refuses everyone while no secret is set", () => {
    env.current = {};
    expect(() => requireCronSecret(call(`Bearer ${SECRET}`))).toThrow(
      expect.objectContaining({ code: "CRON_SECRET_INVALID" }),
    );
  });
});
