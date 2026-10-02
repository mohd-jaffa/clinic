import { describe, expect, it, vi } from "vitest";

import { updateProfile } from "@/features/auth/account";
import { aSession } from "@tests/support/auth";
import { authError, fakeSupabase, postgrestError, type FakeAnswer } from "@tests/support/supabase";

function server(saved: FakeAnswer = { data: { full_name: "Asha M", phone: "+919876500000" } }, authFails?: string) {
  const updateUserById = vi.fn(async () => ({ error: authFails ? authError(authFails) : null }));
  const fake = fakeSupabase({ answer: () => saved, auth: { admin: { updateUserById } } });
  return { ...fake, updateUserById };
}

const session = aSession();

describe("updateProfile", () => {
  it("changes the name on the profile only", async () => {
    const admin = server({ data: { full_name: "Asha M", phone: session.profile.phone } });
    const profile = await updateProfile(admin.client, session, { fullName: "Asha M" });

    expect(admin.find("profiles", "update", { full_name: "Asha M" })).toBeDefined();
    expect(admin.updateUserById).not.toHaveBeenCalled();
    expect(profile).toEqual({ ...session.profile, fullName: "Asha M" });
  });

  it("changes the mobile on the profile and then in Supabase Auth, where it signs in", async () => {
    const admin = server();
    await updateProfile(admin.client, session, { phone: "+919876500000" });
    expect(admin.updateUserById).toHaveBeenCalledWith("user-1", { phone: "+919876500000", phone_confirm: true });
  });

  it("writes nothing when nothing changed", async () => {
    const admin = server();
    const same = { fullName: session.profile.fullName, phone: session.profile.phone! };
    expect(await updateProfile(admin.client, session, same)).toBe(session.profile);
    expect(await updateProfile(admin.client, session, {})).toBe(session.profile);
    expect(admin.queries).toEqual([]);
  });

  it("refuses a mobile another account holds", async () => {
    const admin = server({ error: postgrestError("23505") });
    await expect(updateProfile(admin.client, session, { phone: "+919876500000" })).rejects.toMatchObject({
      code: "AUTH_PHONE_ALREADY_EXISTS",
      httpStatus: 409,
    });
  });

  it("says any other database failure as the app's own", async () => {
    const admin = server({ error: postgrestError("XX000") });
    await expect(updateProfile(admin.client, session, { fullName: "B" })).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("puts the mobile back on the profile when Supabase Auth refuses it", async () => {
    const taken = server(undefined, "phone_exists");
    await expect(updateProfile(taken.client, session, { phone: "+919876500000" })).rejects.toMatchObject({
      code: "AUTH_PHONE_ALREADY_EXISTS",
    });
    expect(taken.find("profiles", "update", { phone: session.profile.phone })).toBeDefined();

    const down = server(undefined, "unexpected_failure");
    await expect(updateProfile(down.client, session, { phone: "+919876500000" })).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE_ERROR",
    });
  });
});
