import { describe, expect, it, vi } from "vitest";

import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { resendConfirmation } = vi.hoisted(() => ({ resendConfirmation: vi.fn() }));
vi.mock("@/features/auth/register", () => ({ resendConfirmation }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/auth/resend-confirmation/route");

describe("POST /api/auth/resend-confirmation", () => {
  it("sends the confirmation again to the address given", async () => {
    resendConfirmation.mockResolvedValue({ accepted: true });
    const { status, body } = await answerOf(
      await POST(apiRequest("/api/auth/resend-confirmation", { body: { email: "asha@example.com" } })),
    );

    expect(resendConfirmation).toHaveBeenCalledWith("service-client", { email: "asha@example.com" });
    expect({ status, body }).toMatchObject({ status: 200, body: { data: { accepted: true } } });
  });
});
