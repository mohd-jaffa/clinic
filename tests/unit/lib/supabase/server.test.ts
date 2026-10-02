import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn(() => ({})) }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
  }),
}));

const { createSupabaseAnonClient, createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

beforeEach(() => {
  createClient.mockClear();
});

describe("createSupabaseAnonClient", () => {
  it("acts as the person whose token it carries, keeping no session of its own", () => {
    createSupabaseAnonClient("tok");
    expect(createClient).toHaveBeenCalledWith("http://127.0.0.1:55321", "anon-key", {
      auth: noSession,
      global: { headers: { Authorization: "Bearer tok" } },
    });
  });

  it("acts as nobody with no token, for signing in", () => {
    createSupabaseAnonClient();
    expect(createClient).toHaveBeenCalledWith("http://127.0.0.1:55321", "anon-key", {
      auth: noSession,
      global: undefined,
    });
  });
});

describe("createSupabaseServiceRoleClient", () => {
  it("is the server's own, with the service key and no session", () => {
    createSupabaseServiceRoleClient();
    expect(createClient).toHaveBeenCalledWith("http://127.0.0.1:55321", "service-key", { auth: noSession });
  });
});
