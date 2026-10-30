import type { SupabaseClient } from "@supabase/supabase-js";

import { PAGE_SIZE } from "@/constants/limits";
import { PLATFORM_SETTING_COLUMNS } from "@/constants/platform";
import type { ClinicRole, PlatformRole } from "@/constants/roles";
import type {
  AuditAction,
  ClinicStanding,
  ClinicType,
  ConsoleClinicFilter,
  ErrorSource,
  ExtensionKind,
  MemberStatus,
  PaymentMethod,
  SubscriptionPlan,
  SubscriptionState,
} from "@/constants/statuses";
import { pageWindow, toPage, type Page } from "@/lib/api/pagination";
import { fromPostgrestError, notFoundError } from "@/lib/errors";
import { toPlatformSettings, type PlatformSettingsRow } from "@/lib/platform/settings";
import { searchTerms } from "@/lib/supabase/search";

import type {
  ConsoleAccount,
  ConsoleAuditEntry,
  ConsoleClinic,
  ConsoleClinicDetail,
  ConsoleError,
  ConsoleOverview,
  ConsolePlanPayment,
  ConsoleSettings,
} from "./types";

/**
 * The developer console's reads (plan §20; D367 – D372), each one call to
 * 0035's functions or one fixed query, made by the server as itself (the
 * service role, which `withDevRoute` hands over only to the DEV). None reads
 * a clinic's data: what each answers is all the console shows.
 */

/** What `console_overview` hands back. */
export interface OverviewRow {
  today: string;
  clinics: number;
  buckets: Record<ClinicStanding, number>;
  no_trial: number;
  signups_week: number;
  signups_month: number;
  extensions_month: number;
}

/** A row of `console_clinic_rows`, as `console_clinics` and `console_clinic` hand it back. */
export interface ClinicRow {
  id: string;
  name: string;
  clinic_type: ClinicType;
  city: string;
  signed_up_at: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string | null;
  plan: SubscriptionPlan;
  valid_until: string;
  state: SubscriptionState;
  bucket: ClinicStanding;
  members: number;
  no_trial: boolean;
}

export interface ClinicPaymentRow {
  id: string;
  plan: ExtensionKind;
  amount_paise: number;
  method: PaymentMethod | null;
  reference: string | null;
  paid_on: string | null;
  valid_from: string;
  valid_until: string;
  reason: string | null;
  receipt_number: string | null;
  recorded_by_name: string | null;
  created_at: string;
}

/** What `console_clinic` hands back: the clinic's row, its plan's history and the live prices. */
export interface ClinicDetailRow extends ClinicRow {
  payments: ClinicPaymentRow[];
  prices: { monthly_paise: number; yearly_paise: number };
}

/** What `console_accounts` hands back for each account. */
export interface AccountRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  platform_role: PlatformRole | null;
  created_at: string;
  clinic_id: string | null;
  clinic_name: string | null;
  role: ClinicRole | null;
  status: MemberStatus | null;
  last_sign_in_at: string | null;
}

/** A row of `error_logs` (0006), with who was asking and the clinic's name. */
export interface ErrorRow {
  id: string;
  source: ErrorSource;
  message: string;
  reference: string | null;
  code: string | null;
  kind: string | null;
  http_status: number | null;
  method: string | null;
  path: string | null;
  detail: string | null;
  stack: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
  account: { full_name: string; email: string } | null;
  clinic: { name: string } | null;
}

/** What `console_audit` hands back for each entry. */
export interface AuditRow {
  id: string;
  action: AuditAction;
  entity_type: string;
  changes: Record<string, unknown> | null;
  request_id: string | null;
  created_at: string;
  actor_name: string | null;
  clinic_name: string | null;
}

/** A page of a console list, asked of a function: one row more than a page, so the answer says whether more follow. */
const window = (start: number) => ({ p_offset: start, p_limit: PAGE_SIZE + 1 });

export const toOverview = (row: OverviewRow): ConsoleOverview => ({
  today: row.today,
  clinics: row.clinics,
  standings: row.buckets,
  noTrial: row.no_trial,
  signupsWeek: row.signups_week,
  signupsMonth: row.signups_month,
  extensionsMonth: row.extensions_month,
});

export const toConsoleClinic = (row: ClinicRow): ConsoleClinic => ({
  id: row.id,
  name: row.name,
  type: row.clinic_type,
  city: row.city,
  signedUpAt: row.signed_up_at,
  owner: { name: row.owner_name, email: row.owner_email, phone: row.owner_phone },
  plan: row.plan,
  validUntil: row.valid_until,
  state: row.state,
  standing: row.bucket,
  members: row.members,
  noTrial: row.no_trial,
});

export const toPlanPayment = (row: ClinicPaymentRow): ConsolePlanPayment => ({
  id: row.id,
  kind: row.plan,
  amountPaise: row.amount_paise,
  method: row.method,
  reference: row.reference,
  paidOn: row.paid_on,
  validFrom: row.valid_from,
  validUntil: row.valid_until,
  reason: row.reason,
  receiptNumber: row.receipt_number,
  recordedBy: row.recorded_by_name,
  recordedAt: row.created_at,
});

export const toClinicDetail = (row: ClinicDetailRow): ConsoleClinicDetail => ({
  ...toConsoleClinic(row),
  payments: row.payments.map(toPlanPayment),
  prices: { monthlyPaise: row.prices.monthly_paise, yearlyPaise: row.prices.yearly_paise },
});

export const toAccount = (row: AccountRow): ConsoleAccount => ({
  id: row.id,
  name: row.full_name,
  email: row.email,
  phone: row.phone,
  platformRole: row.platform_role,
  createdAt: row.created_at,
  membership:
    row.clinic_id === null
      ? null
      : { clinicId: row.clinic_id, clinicName: row.clinic_name!, role: row.role!, status: row.status! },
  lastSignInAt: row.last_sign_in_at,
});

export const toConsoleError = (row: ErrorRow): ConsoleError => ({
  id: row.id,
  source: row.source,
  message: row.message,
  reference: row.reference,
  code: row.code,
  kind: row.kind,
  httpStatus: row.http_status,
  method: row.method,
  path: row.path,
  account: row.account ? { name: row.account.full_name, email: row.account.email } : null,
  clinicName: row.clinic?.name ?? null,
  detail: row.detail,
  stack: row.stack,
  context: row.context,
  at: row.created_at,
});

export const toAuditEntry = (row: AuditRow): ConsoleAuditEntry => ({
  id: row.id,
  action: row.action,
  entityType: row.entity_type,
  changes: row.changes,
  requestId: row.request_id,
  actorName: row.actor_name,
  clinicName: row.clinic_name,
  at: row.created_at,
});

/** The Overview (plan §20.1): one call. */
export async function getConsoleOverview(admin: SupabaseClient): Promise<ConsoleOverview> {
  const { data, error } = await admin.rpc("console_overview");
  if (error) throw fromPostgrestError(error);
  return toOverview(data as OverviewRow);
}

/**
 * A page of the Clinics list (plan §20.2; D371): the newest sign-up first,
 * matched on the words and a mobile's digits typed, and kept to one filter.
 */
export async function listConsoleClinics(
  admin: SupabaseClient,
  { search, filter, cursor }: { search?: string | null; filter?: ConsoleClinicFilter; cursor?: number },
): Promise<Page<ConsoleClinic>> {
  const start = cursor ?? 0;
  const { words, digits } = searchTerms(search);
  const { data, error } = await admin.rpc("console_clinics", {
    p_words: words,
    p_digits: digits,
    p_filter: filter ?? null,
    ...window(start),
  });
  if (error) throw fromPostgrestError(error);
  return toPage((data as ClinicRow[]).map(toConsoleClinic), start);
}

/**
 * One clinic's page (plan §20.3): its row, every change recorded to its
 * plan, the latest first, and the live prices.
 */
export async function getConsoleClinic(admin: SupabaseClient, clinicId: string): Promise<ConsoleClinicDetail> {
  const { data, error } = await admin.rpc("console_clinic", { p_clinic_id: clinicId });
  if (error) throw fromPostgrestError(error);
  if (data === null) throw notFoundError("RECORD_NOT_FOUND");
  return toClinicDetail(data as ClinicDetailRow);
}

/** A page of every account (plan §20.5), the newest first, matched on what was typed. */
export async function listConsoleAccounts(
  admin: SupabaseClient,
  { search, cursor }: { search?: string | null; cursor?: number },
): Promise<Page<ConsoleAccount>> {
  const start = cursor ?? 0;
  const { words, digits } = searchTerms(search);
  const { data, error } = await admin.rpc("console_accounts", { p_words: words, p_digits: digits, ...window(start) });
  if (error) throw fromPostgrestError(error);
  return toPage((data as AccountRow[]).map(toAccount), start);
}

const ERROR_COLUMNS =
  "id, source, message, reference, code, kind, http_status, method, path, detail, stack, context, created_at, " +
  "account:profiles(full_name, email), clinic:clinics(name)";

/** A page of the error log (plan §20.6; D372), the latest first, each whole so a row opens on all of it. */
export async function listConsoleErrors(
  admin: SupabaseClient,
  { cursor }: { cursor?: number },
): Promise<Page<ConsoleError>> {
  const start = cursor ?? 0;
  const range = pageWindow(start);
  const { data, error } = await admin
    .from("error_logs")
    .select(ERROR_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(range.from, range.to);
  if (error) throw fromPostgrestError(error);
  return toPage((data as unknown as ErrorRow[]).map(toConsoleError), start);
}

/** The settings row, with when it was last changed and by whom. */
type SettingsRow = PlatformSettingsRow & { updated_at: string; editor: { full_name: string } | null };

const SETTINGS_COLUMNS = `${Object.values(PLATFORM_SETTING_COLUMNS).join(", ")}, updated_at, editor:profiles(full_name)`;

/** The platform settings (plan §20.4; D378): every one, and who last changed them — one query. */
export async function getConsoleSettings(admin: SupabaseClient): Promise<ConsoleSettings> {
  const { data, error } = await admin.from("platform_settings").select(SETTINGS_COLUMNS).single();
  if (error) throw fromPostgrestError(error);
  const row = data as unknown as SettingsRow;
  return { settings: toPlatformSettings(row), updatedAt: row.updated_at, updatedBy: row.editor?.full_name ?? null };
}

/** A page of the platform audit (plan §20.7), the latest first. */
export async function listConsoleAudit(
  admin: SupabaseClient,
  { cursor }: { cursor?: number },
): Promise<Page<ConsoleAuditEntry>> {
  const start = cursor ?? 0;
  const { data, error } = await admin.rpc("console_audit", window(start));
  if (error) throw fromPostgrestError(error);
  return toPage((data as AuditRow[]).map(toAuditEntry), start);
}
