import { describe, expect, it, vi } from "vitest";

import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { previewInvite } = vi.hoisted(() => ({ previewInvite: vi.fn() }));
vi.mock("@/features/team/accept", () => ({ previewInvite }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/auth/accept-invite/preview/route");

const TOKEN = "t".repeat(43);

describe("POST /api/auth/accept-invite/preview (plan §8.5)", () => {
  it("answers anyone with what a link opens onto, read as the server", async () => {
    previewInvite.mockResolvedValue({ clinicName: "Smile Care", role: "STAFF" });
    const { status, body } = await answerOf(
      await POST(apiRequest("/api/auth/accept-invite/preview", { body: { token: TOKEN } })),
    );
    expect({ status, body }).toMatchObject({ status: 200, body: { data: { clinicName: "Smile Care" } } });
    expect(previewInvite).toHaveBeenCalledWith("service-client", { token: TOKEN });
  });

  it("refuses a token that cannot be one", async () => {
    const { status } = await answerOf(
      await POST(apiRequest("/api/auth/accept-invite/preview", { body: { token: "x" } })),
    );
    expect(status).toBe(400);
  });
});
