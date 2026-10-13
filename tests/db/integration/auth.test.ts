import { afterAll, describe, expect, it } from "vitest";

import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { AUTH_ROUTES } from "@/constants/routes";
import { DEFAULT_APPOINTMENT_TYPES, DEFAULT_CONSULTATION_SERVICE, DEFAULT_EXPENSE_CATEGORIES } from "@/constants/seeds";
import { updateProfile } from "@/features/auth/account";
import { changePassword, completePasswordReset, requestPasswordReset } from "@/features/auth/password";
import { register, resendConfirmation } from "@/features/auth/register";
import { confirmEmail, getSession, logout, refreshSession } from "@/features/auth/session";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import {
  changePasswordSchema,
  emailRequestSchema,
  passwordResetCompleteSchema,
  updateProfileSchema,
} from "@/lib/validation";
import {
  addMember,
  admin,
  aMobileNumber,
  aPassword,
  deleteAfter,
  registerClinic,
  registration,
  removeAll,
  setMemberStatus,
  signIn,
  userIdOf,
} from "@tests/support/integration";
import { authLinkIn, followAuthLink, latestMessageTo, messagesTo } from "@tests/support/mailpit";

/**
 * Signing up, confirming, signing in and keeping an account (plan §5, R1.8 –
 * R1.10), against the local Supabase and its mail server, as a person does it.
 */
afterAll(removeAll);

describe("signing up a clinic", () => {
  it("makes the clinic on a free trial, emails a confirmation, and signs in only once it is confirmed", async () => {
    const details = registration({ clinicName: "Smile Dental", phone: aMobileNumber() });
    const answer = await register(admin(), details);
    expect(answer).toEqual({ email: details.email, trial: true, confirmationSent: true });
    const userId = await userIdOf(details.email);
    deleteAfter({ userId });

    // Not before the email is confirmed (Q17), by email or by mobile.
    await expect(signIn(details.email, details.password)).rejects.toMatchObject({ code: "AUTH_EMAIL_NOT_CONFIRMED" });
    await expect(signIn(details.phone.slice(3), details.password)).rejects.toMatchObject({
      code: "AUTH_EMAIL_NOT_CONFIRMED",
    });

    // The email, and its link, land on the confirm screen signed in.
    const email = await latestMessageTo(details.email);
    expect(email.subject).toMatch(/Confirm your email/);
    const link = await followAuthLink(authLinkIn(email.text));
    expect(link.landing).toBe(`${process.env.NEXT_PUBLIC_APP_URL}${AUTH_ROUTES.confirmEmail}`);

    const session = await confirmEmail(createSupabaseAnonClient(), admin(), link);
    deleteAfter({ clinicId: session.membership!.clinicId });
    expect(session.profile).toMatchObject({ fullName: details.fullName, email: details.email, phone: details.phone });
    expect(session.membership).toMatchObject({
      clinicName: "Smile Dental",
      role: "OWNER",
      doctorId: expect.any(String),
    });
    expect(session.membership!.permissions).toContain("settings.manage");
    expect(session.subscription).toMatchObject({
      plan: "TRIAL",
      state: "ACTIVE",
      validUntil: addDaysKey(todayKey(), PLATFORM_SETTING_DEFAULTS.trialDays),
    });

    // Then by email, and by the mobile however it is written (plan §5.2).
    const national = details.phone.slice(3);
    for (const identifier of [
      details.email.toUpperCase(),
      national,
      `0${national}`,
      `+91 ${national.slice(0, 5)} ${national.slice(5)}`,
    ]) {
      await expect(signIn(identifier, details.password)).resolves.toMatchObject({ profile: { id: userId } });
    }
  });

  it("seeds what every clinic starts with (src/constants/seeds.ts)", async () => {
    const { owner } = await registerClinic();
    const { supabase } = owner.tenant;

    const { data: types } = await supabase.from("appointment_types").select("name, default_minutes").order("position");
    expect(types).toEqual(DEFAULT_APPOINTMENT_TYPES.map(({ name, minutes }) => ({ name, default_minutes: minutes })));

    const { data: categories } = await supabase.from("expense_categories").select("name").order("position");
    expect(categories!.map(({ name }) => name)).toEqual(DEFAULT_EXPENSE_CATEGORIES);

    const { data: services } = await supabase.from("services").select("name, category, price_paise, created_by");
    expect(services).toEqual([
      {
        name: DEFAULT_CONSULTATION_SERVICE.name,
        category: DEFAULT_CONSULTATION_SERVICE.category,
        price_paise: DEFAULT_CONSULTATION_SERVICE.pricePaise,
        created_by: owner.userId,
      },
    ]);
  });

  it("gives no doctor profile to an owner who does not see patients", async () => {
    const { owner } = await registerClinic({ seesPatients: false });
    expect(owner.session.membership!.doctorId).toBeNull();
  });

  it("refuses an email or a mobile another account holds", async () => {
    const { owner } = await registerClinic();
    await expect(register(admin(), registration({ email: owner.email }))).rejects.toMatchObject({
      code: "AUTH_EMAIL_ALREADY_EXISTS",
    });
    await expect(register(admin(), registration({ phone: owner.phone }))).rejects.toMatchObject({
      code: "AUTH_PHONE_ALREADY_EXISTS",
    });
  });

  it("undoes the account when the clinic cannot be made, so the same details can sign up again", async () => {
    const details = registration();
    await expect(register(admin(), { ...details, clinicType: "VETERINARY" as never })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    const { data } = await admin().from("profiles").select("id").eq("email", details.email);
    expect(data).toEqual([]);

    await register(admin(), details);
    deleteAfter({ userId: await userIdOf(details.email) });
  });

  it("gives no second free trial to a mobile that has had one (D42)", async () => {
    const phone = aMobileNumber();
    const first = await registerClinic({ phone });
    expect(first.owner.session.subscription!.plan).toBe("TRIAL");

    // The first clinic and its owner are deleted; the claim outlives them.
    await admin().from("clinics").delete().eq("id", first.clinicId);
    await admin().auth.admin.deleteUser(first.owner.userId);

    const again = registration({ phone });
    expect(await register(admin(), again)).toMatchObject({ trial: false });
    const userId = await userIdOf(again.email);
    deleteAfter({ userId });
    await admin().auth.admin.updateUserById(userId, { email_confirm: true });
    const session = await signIn(again.email, again.password);
    deleteAfter({ clinicId: session.membership!.clinicId });
    expect(session.subscription).toMatchObject({ plan: "TRIAL", state: "READ_ONLY" });
  });
});

describe("resending the confirmation", () => {
  it("answers the same for an address with no account, and sends nothing", async () => {
    const email = registration().email;
    await expect(resendConfirmation(admin(), emailRequestSchema.parse({ email }))).resolves.toEqual({ accepted: true });
    expect(await messagesTo(email)).toEqual([]);
  });

  it("sends nothing more within a minute of the last, nor to an address already confirmed", async () => {
    const details = registration();
    await register(admin(), details);
    deleteAfter({ userId: await userIdOf(details.email) });
    await latestMessageTo(details.email);

    await resendConfirmation(admin(), emailRequestSchema.parse({ email: details.email }));
    expect(await messagesTo(details.email)).toHaveLength(1);

    const { owner } = await registerClinic();
    await admin().from("profiles").update({ email_link_sent_at: null }).eq("id", owner.userId);
    await resendConfirmation(admin(), emailRequestSchema.parse({ email: owner.email }));
    expect(await messagesTo(owner.email)).toHaveLength(1);
  });

  it("sends another once the minute has passed", async () => {
    const details = registration();
    await register(admin(), details);
    const userId = await userIdOf(details.email);
    deleteAfter({ userId });
    await latestMessageTo(details.email);
    await admin().from("profiles").update({ email_link_sent_at: "2026-01-01T00:00:00Z" }).eq("id", userId);

    await resendConfirmation(admin(), emailRequestSchema.parse({ email: details.email }));
    await expect.poll(async () => (await messagesTo(details.email)).length).toBe(2);
  });
});

describe("a session", () => {
  it("refuses a wrong password and an unknown account with the same words", async () => {
    const { owner } = await registerClinic();
    await expect(signIn(owner.email, "wrong-password")).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
    await expect(signIn(registration().email, owner.password)).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
    });
  });

  it("is read back from its token, refreshed, and ended by signing out", async () => {
    const { owner } = await registerClinic();
    const read = await getSession(admin(), owner.session.accessToken);
    expect(read.membership).toEqual(owner.session.membership);

    const renewed = await refreshSession(createSupabaseAnonClient(), admin(), owner.session.refreshToken);
    expect(renewed.accessToken).not.toBe(owner.session.accessToken);

    await logout(admin(), renewed.accessToken);
    await expect(refreshSession(createSupabaseAnonClient(), admin(), renewed.refreshToken)).rejects.toMatchObject({
      code: "AUTH_SESSION_INVALID",
    });
  });

  it("is refused to a member deactivated or not yet joined, at sign-in and at the next request", async () => {
    const { clinicId } = await registerClinic();
    const staff = await addMember(clinicId, { permissions: ["patients.view"] });
    await expect(getSession(admin(), staff.session.accessToken)).resolves.toBeTruthy();

    await setMemberStatus(staff.memberId, "INACTIVE");
    await expect(getSession(admin(), staff.session.accessToken)).rejects.toMatchObject({
      code: "AUTH_MEMBERSHIP_INACTIVE",
    });
    await expect(signIn(staff.email, staff.password)).rejects.toMatchObject({ code: "AUTH_MEMBERSHIP_INACTIVE" });

    const invited = await addMember(clinicId, { status: "INVITED" });
    await expect(signIn(invited.email, invited.password)).rejects.toMatchObject({ code: "AUTH_MEMBERSHIP_INACTIVE" });
  });
});

describe("a forgotten password", () => {
  it("is reset by the emailed link, which signs the person in with the new one", async () => {
    const { owner } = await registerClinic();
    await admin().from("profiles").update({ email_link_sent_at: null }).eq("id", owner.userId);

    await expect(requestPasswordReset(admin(), emailRequestSchema.parse({ email: owner.email }))).resolves.toEqual({
      accepted: true,
    });
    const email = await latestMessageTo(owner.email);
    expect(email.subject).toMatch(/Reset your/);
    const link = await followAuthLink(authLinkIn(email.text));
    expect(link.landing).toBe(`${process.env.NEXT_PUBLIC_APP_URL}${AUTH_ROUTES.resetPassword}`);

    const password = aPassword();
    const session = await completePasswordReset(
      createSupabaseAnonClient(),
      admin(),
      passwordResetCompleteSchema.parse({ ...link, password }),
    );
    expect(session.profile.id).toBe(owner.userId);

    await expect(signIn(owner.email, owner.password)).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
    await expect(signIn(owner.email, password)).resolves.toBeTruthy();
    // The session the owner had before is over.
    await expect(refreshSession(createSupabaseAnonClient(), admin(), owner.session.refreshToken)).rejects.toMatchObject(
      { code: "AUTH_SESSION_INVALID" },
    );
  });

  it("answers the same for an address with no account, and sends nothing", async () => {
    const email = registration().email;
    await expect(requestPasswordReset(admin(), emailRequestSchema.parse({ email }))).resolves.toEqual({
      accepted: true,
    });
    expect(await messagesTo(email)).toEqual([]);
  });

  it("refuses a link that has been used", async () => {
    const { owner } = await registerClinic();
    await admin().from("profiles").update({ email_link_sent_at: null }).eq("id", owner.userId);
    await requestPasswordReset(admin(), emailRequestSchema.parse({ email: owner.email }));
    const link = await followAuthLink(authLinkIn((await latestMessageTo(owner.email)).text));
    await completePasswordReset(
      createSupabaseAnonClient(),
      admin(),
      passwordResetCompleteSchema.parse({ ...link, password: aPassword() }),
    );
    await signIn(owner.email, owner.password).catch(() => undefined);

    await expect(
      completePasswordReset(
        createSupabaseAnonClient(),
        admin(),
        passwordResetCompleteSchema.parse({ ...link, accessToken: "used", password: aPassword() }),
      ),
    ).rejects.toMatchObject({ code: "AUTH_LINK_INVALID" });
  });
});

describe("my account", () => {
  it("changes the password only with the current one, and ends every other session", async () => {
    const { owner } = await registerClinic();
    const elsewhere = await signIn(owner.email, owner.password);

    await expect(
      changePassword(
        createSupabaseAnonClient(),
        admin(),
        owner.session,
        changePasswordSchema.parse({ currentPassword: "not-it", newPassword: aPassword() }),
      ),
    ).rejects.toMatchObject({ code: "AUTH_PASSWORD_INCORRECT" });

    const newPassword = aPassword();
    const changed = await changePassword(
      createSupabaseAnonClient(),
      admin(),
      owner.session,
      changePasswordSchema.parse({ currentPassword: owner.password, newPassword }),
    );
    // This device is handed a fresh session; the one elsewhere is over.
    await expect(getSession(admin(), changed.accessToken)).resolves.toBeTruthy();
    await expect(signIn(owner.email, newPassword)).resolves.toBeTruthy();
    await expect(refreshSession(createSupabaseAnonClient(), admin(), elsewhere.refreshToken)).rejects.toMatchObject({
      code: "AUTH_SESSION_INVALID",
    });
  });

  it("changes the name and the mobile, which then signs in; a mobile another account holds is refused", async () => {
    const { owner } = await registerClinic();
    const other = await registerClinic();
    const phone = aMobileNumber();

    const profile = await updateProfile(
      admin(),
      owner.session,
      updateProfileSchema.parse({ fullName: "Dr. Maya Rao", phone }),
    );
    expect(profile).toMatchObject({ fullName: "Dr. Maya Rao", phone: `+91${phone}` });
    await expect(signIn(phone, owner.password)).resolves.toMatchObject({ profile: { fullName: "Dr. Maya Rao" } });

    await expect(
      updateProfile(admin(), owner.session, updateProfileSchema.parse({ phone: other.owner.phone })),
    ).rejects.toMatchObject({ code: "AUTH_PHONE_ALREADY_EXISTS" });
  });
});
