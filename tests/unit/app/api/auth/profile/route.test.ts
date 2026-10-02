import { describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, updateProfile } = vi.hoisted(() => ({ getSession: vi.fn(), updateProfile: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/auth/account", () => ({ updateProfile }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { PATCH } = await import("@/app/api/auth/profile/route");

describe("PATCH /api/auth/profile", () => {
  it("changes the signed-in person's name and mobile, tidied", async () => {
    const session = aSession();
    getSession.mockResolvedValue(session);
    updateProfile.mockResolvedValue({ fullName: "Asha M", phone: "+919876500000" });

    const { status, body } = await answerOf(
      await PATCH(
        apiRequest("/api/auth/profile", {
          method: "PATCH",
          body: { fullName: " Asha  M ", phone: "98765 00000" },
          headers: { authorization: "Bearer tok" },
        }),
      ),
    );

    expect(updateProfile).toHaveBeenCalledWith("service-client", session, {
      fullName: "Asha M",
      phone: "+919876500000",
    });
    expect({ status, body }).toMatchObject({ status: 200, body: { data: { fullName: "Asha M" } } });
  });
});
