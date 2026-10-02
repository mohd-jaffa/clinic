import { describe, expect, it, vi } from "vitest";

import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { requestPasswordReset } = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }));
vi.mock("@/features/auth/password", () => ({ requestPasswordReset }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/auth/password-reset/route");

describe("POST /api/auth/password-reset", () => {
  it("asks for a reset link to the address given, answering the same either way", async () => {
    requestPasswordReset.mockResolvedValue({ accepted: true });
    const { status, body } = await answerOf(
      await POST(apiRequest("/api/auth/password-reset", { body: { email: "asha@example.com" } })),
    );

    expect(requestPasswordReset).toHaveBeenCalledWith("service-client", { email: "asha@example.com" });
    expect({ status, body }).toMatchObject({ status: 200, body: { data: { accepted: true } } });
  });
});
