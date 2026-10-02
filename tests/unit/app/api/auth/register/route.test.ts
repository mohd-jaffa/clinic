import { describe, expect, it, vi } from "vitest";

import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { register } = vi.hoisted(() => ({ register: vi.fn() }));
vi.mock("@/features/auth/register", () => ({ register }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/auth/register/route");

const form = {
  fullName: "  Asha   Menon ",
  email: "Asha@Example.com",
  phone: "098765 43210",
  password: "a secret ",
  seesPatients: true,
  clinicName: "Smile Care",
  clinicType: "DENTAL",
  city: "Kochi",
  address: "12 MG Road",
  clinicPhone: "",
};

describe("POST /api/auth/register", () => {
  it("makes the owner and the clinic from the tidied form, answering 201 with no session", async () => {
    register.mockResolvedValue({ email: "asha@example.com", trial: true, confirmationSent: true });
    const response = await POST(apiRequest("/api/auth/register", { body: form }));

    expect(register).toHaveBeenCalledWith(
      "service-client",
      expect.objectContaining({
        fullName: "Asha Menon",
        email: "asha@example.com",
        phone: "+919876543210",
        password: "a secret ",
        clinicPhone: null,
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("refuses a form with a clinic type it does not know", async () => {
    const { status } = await answerOf(
      await POST(apiRequest("/api/auth/register", { body: { ...form, clinicType: "VET" } })),
    );
    expect(status).toBe(400);
  });
});
