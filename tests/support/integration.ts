import { randomBytes, randomInt, randomUUID } from "node:crypto";

import type { Permission } from "@/constants/permissions";
import type { ClinicRole } from "@/constants/roles";
import type { MemberStatus } from "@/constants/statuses";
import { LOGO_BUCKET } from "@/constants/uploads";
import { register } from "@/features/auth/register";
import { login } from "@/features/auth/session";
import type { AuthenticatedSession } from "@/features/auth/types";
import { logoFolder } from "@/features/clinic/logo";
import { hashInviteToken } from "@/features/team/invites";
import { createSupabaseAnonClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/supabase/tenant";
import { loginSchema, registerSchema, type RegisterInput } from "@/lib/validation";

/**
 * Clinics and people for the integration tests (tests/db/integration, plan
 * §34.3): each clinic made as the app signs one up, its owner signed in as the
 * app signs in, and all of it deleted after.
 */

export const admin = () => createSupabaseServiceRoleClient();

/** Ten digits a mobile number may have, unlikely to be anyone's. */
export const aMobileNumber = () => `9${randomInt(100_000_000, 1_000_000_000)}`;

export const anEmail = () => `it-${randomUUID().slice(0, 12)}@clinicdesk.test`;

export const aPassword = () => `Test-${randomUUID()}`;

/** A sign-up as the register screen sends it. */
export function registration(overrides: Partial<RegisterInput> = {}) {
  return registerSchema.parse({
    fullName: "Test Owner",
    email: anEmail(),
    phone: aMobileNumber(),
    password: aPassword(),
    seesPatients: true,
    clinicName: "Test Clinic",
    clinicType: "DENTAL",
    city: "Kochi",
    address: "1 Test Street",
    ...overrides,
  });
}

/** Someone signed in: their session, and the tenant a clinic route would build from it. */
export interface SignedIn {
  userId: string;
  email: string;
  password: string;
  session: AuthenticatedSession;
  /** As `withClinicRoute` builds it; null for someone with no clinic. */
  tenant: Tenant | null;
}

export interface TestClinic {
  clinicId: string;
  owner: SignedIn & { tenant: Tenant; phone: string };
}

const users: string[] = [];
const clinics: string[] = [];

/** The tenant a clinic route would build from this session (plan §27.1). */
export function tenantOf(session: AuthenticatedSession): Tenant | null {
  const { membership } = session;
  if (!membership) return null;
  return {
    supabase: createSupabaseAnonClient(session.accessToken),
    clinicId: membership.clinicId,
    actorId: session.profile.id,
    memberId: membership.id,
    role: membership.role,
    permissions: membership.permissions,
    doctorId: membership.doctorId,
  };
}

/** Signs in as `POST /api/auth/login` does. */
export async function signIn(identifier: string, password: string): Promise<AuthenticatedSession> {
  return login(createSupabaseAnonClient(), admin(), loginSchema.parse({ identifier, password }));
}

/** Marks an account's email confirmed, as following the confirmation link would. */
export async function confirmEmailOf(userId: string): Promise<void> {
  const { error } = await admin().auth.admin.updateUserById(userId, { email_confirm: true });
  if (error) throw error;
}

export async function userIdOf(email: string): Promise<string> {
  const { data, error } = await admin().from("profiles").select("id").eq("email", email).single();
  if (error) throw error;
  return data.id as string;
}

/** Signs up a clinic as `POST /api/auth/register` does, confirms its owner's email, and signs them in. */
export async function registerClinic(overrides: Partial<RegisterInput> = {}): Promise<TestClinic> {
  const details = registration(overrides);
  await register(admin(), details);
  const userId = await userIdOf(details.email);
  users.push(userId);
  await confirmEmailOf(userId);

  const session = await signIn(details.email, details.password);
  const clinicId = session.membership!.clinicId;
  clinics.push(clinicId);
  return {
    clinicId,
    owner: {
      userId,
      email: details.email,
      phone: details.phone,
      password: details.password,
      session,
      tenant: tenantOf(session)!,
    },
  };
}

/** An account made by the server, as an invite will make one (Phase 3), with a confirmed email. */
async function makeUser(fullName: string): Promise<{ userId: string; email: string; password: string }> {
  const email = anEmail();
  const password = aPassword();
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = data.user.id;
  users.push(userId);
  const { error: failed } = await admin().from("profiles").insert({ id: userId, full_name: fullName, email });
  if (failed) throw failed;
  return { userId, email, password };
}

/**
 * A member of a clinic, written as the server would (the team functions come
 * in Phase 3), and signed in when active.
 */
export async function addMember(
  clinicId: string,
  {
    role = "STAFF",
    permissions = [],
    status = "ACTIVE",
    doctor = role === "DOCTOR",
  }: { role?: Exclude<ClinicRole, "OWNER">; permissions?: Permission[]; status?: MemberStatus; doctor?: boolean } = {},
): Promise<SignedIn & { memberId: string }> {
  const person = await makeUser(`Test ${role.toLowerCase()}`);
  const { data, error } = await admin()
    .from("clinic_members")
    .insert({
      clinic_id: clinicId,
      user_id: person.userId,
      role,
      status: "ACTIVE",
      permissions,
      joined_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  const memberId = data.id as string;
  if (doctor) {
    const { error: failed } = await admin().from("doctors").insert({ clinic_id: clinicId, member_id: memberId });
    if (failed) throw failed;
  }

  const session = await signIn(person.email, person.password);
  if (status !== "ACTIVE") await setMemberStatus(memberId, status);
  return { ...person, memberId, session, tenant: tenantOf(session) };
}

/**
 * An open invite whose link the test holds (plan §8.4): the account and the
 * invite written as the server writes them, with a token of the test's own —
 * the journeys send no mail to read one from.
 */
export async function inviteWithToken(
  clinic: TestClinic,
  { fullName = "Meera Pillai", role = "STAFF" }: { fullName?: string; role?: "DOCTOR" | "STAFF" } = {},
): Promise<{ email: string; token: string }> {
  const email = anEmail();
  const { data, error } = await admin().auth.admin.createUser({ email, email_confirm: false });
  if (error) throw error;
  users.push(data.user.id);
  const token = randomBytes(32).toString("base64url");
  const { error: refused } = await admin().rpc("invite_member", {
    p_clinic_id: clinic.clinicId,
    p_actor_id: clinic.owner.userId,
    p_user_id: data.user.id,
    p_full_name: fullName,
    p_email: email,
    p_role: role,
    p_job_title: null,
    p_permissions: ["patients.view"],
    p_doctor: role === "DOCTOR" ? {} : null,
    p_token_hash: hashInviteToken(token),
  });
  if (refused) throw refused;
  return { email, token };
}

/** Changes a membership's status as the team screen will. */
export async function setMemberStatus(memberId: string, status: MemberStatus): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin()
    .from("clinic_members")
    .update({
      status,
      deactivated_at: status === "INACTIVE" ? now : null,
      invite_expires_at: status === "INVITED" ? now : null,
      invite_token_hash: status === "INVITED" ? randomBytes(32).toString("hex") : null,
    })
    .eq("id", memberId);
  if (error) throw error;
}

/** The platform admin (plan §3.2): an account given DEV from the dashboard, and signed in. */
export async function makeDeveloper(): Promise<SignedIn> {
  const person = await makeUser("Test Developer");
  const { error } = await admin().from("profiles").update({ platform_role: "DEV" }).eq("id", person.userId);
  if (error) throw error;
  return { ...person, session: await signIn(person.email, person.password), tenant: null };
}

/** Sets a clinic's last day of access, as the admin's Set date would. */
export async function setValidUntil(clinicId: string, validUntil: string): Promise<void> {
  const { error } = await admin()
    .from("clinic_subscriptions")
    .update({ valid_until: validUntil })
    .eq("clinic_id", clinicId);
  if (error) throw error;
}

/** Remembers a clinic and its people made outside these helpers, so `removeAll` deletes them too. */
export function deleteAfter({ clinicId, userId }: { clinicId?: string; userId?: string }) {
  if (clinicId) clinics.push(clinicId);
  if (userId) users.push(userId);
}

/** Deletes every clinic and account these tests made, and all that hangs from them. */
export async function removeAll(): Promise<void> {
  const client = admin();
  // A clinic signed up through register() alone is found through its owner.
  const { data: owned } = await client
    .from("clinic_members")
    .select("clinic_id")
    .eq("role", "OWNER")
    .in("user_id", users);
  for (const { clinic_id } of owned ?? []) if (!clinics.includes(clinic_id)) clinics.push(clinic_id);
  // Accounts the app made for the clinics' invites go with them.
  const { data: members } = await client.from("clinic_members").select("user_id").in("clinic_id", clinics);
  for (const { user_id } of members ?? []) if (!users.includes(user_id)) users.push(user_id);

  for (const clinicId of clinics.splice(0)) {
    // Its logo files first: Storage keeps them past the row (0009_clinic_profile.sql).
    const logos = client.storage.from(LOGO_BUCKET);
    const { data: files } = await logos.list(logoFolder(clinicId));
    if (files?.length) await logos.remove(files.map((file) => `${logoFolder(clinicId)}/${file.name}`));
    const { error } = await client.from("clinics").delete().eq("id", clinicId);
    if (error) throw new Error(`Could not remove the test clinic ${clinicId}: ${error.message}`);
  }
  for (const userId of users.splice(0)) {
    const { error } = await client.auth.admin.deleteUser(userId);
    if (error && error.status !== 404) throw new Error(`Could not remove the test account ${userId}: ${error.message}`);
  }
}
