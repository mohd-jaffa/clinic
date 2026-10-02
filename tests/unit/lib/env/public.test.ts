import { afterEach, describe, expect, it, vi } from "vitest";

import { publicAppUrl, publicAppVersion } from "@/lib/env/public";

afterEach(() => vi.unstubAllEnvs());

describe("publicAppUrl", () => {
  it("is the app's web root as the build wrote it, or nothing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://clinicdesk.example");
    expect(publicAppUrl()).toBe("https://clinicdesk.example");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
    expect(publicAppUrl()).toBe("");
  });
});

describe("publicAppVersion", () => {
  it("is the version the build wrote, or nothing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "0.1.0");
    expect(publicAppVersion()).toBe("0.1.0");
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", undefined);
    expect(publicAppVersion()).toBe("");
  });
});
