import {
  BadgeIndianRupee,
  Building2,
  CalendarClock,
  CalendarCog,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  ChartColumn,
  FileDown,
  FileUp,
  Footprints,
  History,
  House,
  IdCard,
  IndianRupee,
  ListOrdered,
  ReceiptIndianRupee,
  Settings,
  Shapes,
  Tags,
  Trash2,
  UserPlus,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { UI_TEXT } from "./messages";
import { FOLLOW_UP_ACCESS, hasAccess, ROUTE_ACCESS, type Permission, type RouteAccess } from "./permissions";
import { HOME_ROUTE } from "./routes";

/**
 * Where the app can be navigated to (plan §31.1). One set of places, so the
 * phone's bottom bar and More sheet, the tablet's rail and the desktop's
 * sidebar cannot drift apart; each place names who may go there, as its
 * screen's route does (plan §31.2), and a place someone may not open is not
 * shown to them.
 */
export interface NavItem {
  id: keyof typeof UI_TEXT.nav.places;
  label: string;
  icon: LucideIcon;
  href: string;
  access: RouteAccess;
  /** What it holds, under its name in the More sheet. */
  hint?: string;
}

const { places, hints } = UI_TEXT.nav;

type Member = Parameters<typeof hasAccess>[0];

const HOME: NavItem = { id: "home", label: places.home, icon: House, href: HOME_ROUTE, access: ROUTE_ACCESS.member };
/** Today's queue (plan §11.4). */
export const QUEUE_ROUTE = "/queue";
/** The queue's To bill section, which its pin jumps to (D340). */
export const QUEUE_TO_BILL = "to-bill";
/** Where a visit's screen was opened from, when not the queue: its back arrow returns there (D230). */
export const VISIT_FROM = { param: "from", patient: "patient" } as const;
/** A visit's screen (plan §12.2, D195) — opened from the patient's profile, it leads back there (D230). */
export const visitRoute = (id: string, from?: typeof VISIT_FROM.patient) =>
  from ? `/visits/${id}?${VISIT_FROM.param}=${from}` : `/visits/${id}`;
const QUEUE: NavItem = {
  id: "queue",
  label: places.queue,
  icon: ListOrdered,
  href: QUEUE_ROUTE,
  access: "appointments.view",
};
/** The appointments calendar (plan §11.1). */
export const APPOINTMENTS_ROUTE = "/appointments";
const APPOINTMENTS: NavItem = {
  id: "appointments",
  label: places.appointments,
  icon: CalendarDays,
  href: APPOINTMENTS_ROUTE,
  access: "appointments.view",
  hint: hints.appointments,
};
export const PATIENTS_ROUTE = "/patients";
/** A patient's profile (plan §10.3). */
export const patientRoute = (id: string) => `${PATIENTS_ROUTE}/${id}`;
const PATIENTS: NavItem = {
  id: "patients",
  label: places.patients,
  icon: UsersRound,
  href: PATIENTS_ROUTE,
  access: "patients.view",
};
/** The follow-ups to call (plan §14.3): the front desk's as much as the doctors' (D267). */
export const FOLLOW_UPS_ROUTE = "/follow-ups";
const FOLLOW_UPS: NavItem = {
  id: "followUps",
  label: places.followUps,
  icon: CalendarClock,
  href: FOLLOW_UPS_ROUTE,
  access: FOLLOW_UP_ACCESS.list,
  hint: hints.followUps,
};
/** Billing (plan §15.4): To bill, bills, payments and who owes. */
export const BILLING_ROUTE = "/billing";
/**
 * Where a new bill's back arrow leads, when not to what it bills (D302):
 * Billing, or the queue, whose To bill it was started from (D318); or the
 * patient's profile, for a visit to bill offered there (D313) — a visit
 * reception may not open.
 */
export const BILL_FROM = { param: "from", billing: "billing", queue: "queue", patient: "patient" } as const;
export type BillFrom = (typeof BILL_FROM)["billing" | "queue" | "patient"];
/** What a new bill is for (plan §15.2): a visit, an arrival or a patient — or no one yet, to be searched (D313). */
export type NewBillFor = { visit: string } | { appointment: string } | { patient: string };
/** The query naming a void bill a new one issues again (D314). */
export const BILL_REISSUE = "reissue";
/**
 * A new bill (plan §15.2) — for a visit, an arrival or a patient, or no one
 * yet; started from Billing, it leads back there; issuing a void bill again,
 * it names that bill (D314).
 */
export const newBillRoute = (target?: NewBillFor, from?: BillFrom, reissue?: string) => {
  const query = new URLSearchParams(target);
  if (from) query.set(BILL_FROM.param, from);
  if (reissue) query.set(BILL_REISSUE, reissue);
  const text = query.toString();
  return text ? `${BILLING_ROUTE}/new?${text}` : `${BILLING_ROUTE}/new`;
};
/** A bill's page (D314): back to Billing — or, opened from the patient's history, to their profile (D325). */
export const billRoute = (id: string, from?: typeof BILL_FROM.patient) =>
  from ? `/bills/${id}?${BILL_FROM.param}=${from}` : `/bills/${id}`;
const BILLING: NavItem = {
  id: "billing",
  label: places.billing,
  icon: ReceiptIndianRupee,
  href: BILLING_ROUTE,
  access: "payments.view",
  hint: hints.billing,
};
/** The clinic's expenses (plan §16). */
export const EXPENSES_ROUTE = "/expenses";
const EXPENSES: NavItem = {
  id: "expenses",
  label: places.expenses,
  icon: Wallet,
  href: EXPENSES_ROUTE,
  access: "expenses.view",
  hint: hints.expenses,
};
const REPORTS: NavItem = {
  id: "reports",
  label: places.reports,
  icon: ChartColumn,
  href: "/reports",
  access: "reports.view",
  hint: hints.reports,
};
export const TEAM_ROUTE = "/team";
/** A member's page (D94). */
export const memberRoute = (id: string) => `${TEAM_ROUTE}/${id}`;
const TEAM: NavItem = {
  id: "team",
  label: places.team,
  icon: IdCard,
  href: TEAM_ROUTE,
  access: "team.manage",
  hint: hints.team,
};
export const SETTINGS_ROUTE = "/settings";
/** The price list, under Settings (plan §9). */
const PRICE_LIST_SLUG = "price-list";
const SETTINGS: NavItem = {
  id: "settings",
  label: places.settings,
  icon: Settings,
  href: SETTINGS_ROUTE,
  access: ROUTE_ACCESS.member,
  hint: hints.settings,
};

/** Where who is signed in leads: their own name, mobile and password (plan §31.2). */
export const MY_ACCOUNT_ROUTE = "/settings/account";

/** A doctor's prescription templates, from My account (plan §13, D242): the list, a new one, and one of them. */
export const TEMPLATES_ROUTE = `${MY_ACCOUNT_ROUTE}/templates`;
export const NEW_TEMPLATE_ROUTE = `${TEMPLATES_ROUTE}/new`;
export const templateRoute = (id: string) => `${TEMPLATES_ROUTE}/${id}`;

/** The owner's Plan screen (plan §7.5): where the plan banner's How to renew leads (D74). */
export const PLAN_ROUTE = `${SETTINGS_ROUTE}/plan`;

/** Importing patients from a file, the owner's (plan §10.5). */
export const IMPORT_ROUTE = `${SETTINGS_ROUTE}/import`;

/**
 * A row of the Settings index (plan §31.2, D71): the screen it opens, what
 * that screen holds, and who may open it — the clinic's setup for
 * `settings.manage`, the plan and the clinic's records for the owner.
 */
export interface SettingsItem {
  id: keyof typeof UI_TEXT.settings.items;
  label: string;
  hint: string;
  icon: LucideIcon;
  href: string;
  access: RouteAccess;
  /** What lies behind it cannot be undone: its chip is coral (plan §32.1). */
  attention?: boolean;
}

export interface SettingsGroup {
  id: keyof typeof UI_TEXT.settings.groups;
  title: string;
  items: readonly SettingsItem[];
}

const { items: settingsItems, groups: settingsGroups } = UI_TEXT.settings;

const setting = (
  id: SettingsItem["id"],
  icon: LucideIcon,
  access: RouteAccess,
  slug: string,
  attention?: boolean,
): SettingsItem => ({
  id,
  ...settingsItems[id],
  icon,
  href: `${SETTINGS_ROUTE}/${slug}`,
  access,
  ...(attention && { attention }),
});

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    id: "clinic",
    title: settingsGroups.clinic,
    items: [
      setting("clinic", Building2, "settings.manage", "clinic"),
      setting("priceList", Tags, "settings.manage", PRICE_LIST_SLUG),
      setting("appointmentTypes", CalendarCog, "settings.manage", "appointment-types"),
      setting("expenseCategories", Shapes, "settings.manage", "expense-categories"),
      setting("closures", CalendarOff, "settings.manage", "closures"),
    ],
  },
  {
    id: "owner",
    title: settingsGroups.owner,
    items: [
      setting("plan", BadgeIndianRupee, ROUTE_ACCESS.owner, "plan"),
      setting("activity", History, ROUTE_ACCESS.owner, "activity"),
      setting("import", FileUp, ROUTE_ACCESS.owner, "import"),
      setting("export", FileDown, ROUTE_ACCESS.owner, "export"),
      setting("deleteClinic", Trash2, ROUTE_ACCESS.owner, "delete-clinic", true),
    ],
  },
];

/** The Settings groups someone may open, each with only its rows they may; a group left empty is dropped. */
export function settingsFor(member: Member, groups: readonly SettingsGroup[]): SettingsGroup[] {
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => hasAccess(member, item.access)) }))
    .filter((group) => group.items.length > 0);
}

/** The rail and the sidebar, in three groups: the day's work, the money, the clinic. */
export const NAV_GROUPS: readonly (readonly NavItem[])[] = [
  [HOME, QUEUE, APPOINTMENTS, PATIENTS, FOLLOW_UPS],
  [BILLING, EXPENSES, REPORTS],
  [TEAM, SETTINGS],
];

/** Every place, in order. */
export const ALL_NAV: readonly NavItem[] = NAV_GROUPS.flat();

/** The phone's bottom bar: Home and Queue before the ＋, Patients after it, then More. */
export const BOTTOM_NAV = { start: [HOME, QUEUE], end: [PATIENTS] } as const satisfies Record<
  string,
  readonly NavItem[]
>;

/** What lives behind More on a phone: every place the bottom bar does not hold. */
export const MORE_NAV: readonly NavItem[] = ALL_NAV.filter(
  (item) => ![...BOTTOM_NAV.start, ...BOTTOM_NAV.end].includes(item),
);

/** The places someone may open, in the order given. */
export function placesFor(member: Member, items: readonly NavItem[]): NavItem[] {
  return items.filter((item) => hasAccess(member, item.access));
}

/** Whether a path is the one a place points at, or a screen within it. */
export function isActivePath(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Quick add (D67): each action goes to its own screen with its form already
 * open, named by `?add=`, so the outcome is seen in place and Back closes the
 * form. The screen reads the form it owns from here.
 */
export const ADD_PARAM = "add";

export const ADD_FORMS = {
  walkIn: "walk-in",
  appointment: "appointment",
  patient: "patient",
  payment: "payment",
  expense: "expense",
} as const;

export interface QuickAddItem {
  key: (typeof ADD_FORMS)[keyof typeof ADD_FORMS];
  label: string;
  icon: LucideIcon;
  href: string;
  access: Permission;
}

const addTo = (place: NavItem, form: QuickAddItem["key"]) => `${place.href}?${ADD_PARAM}=${form}`;
const { quickActions } = UI_TEXT;

/** What the ＋ can start (plan §31.1), each only for those who may. */
export const QUICK_ADD: readonly QuickAddItem[] = [
  {
    key: ADD_FORMS.walkIn,
    label: quickActions.walkIn,
    icon: Footprints,
    href: addTo(QUEUE, ADD_FORMS.walkIn),
    access: "appointments.create",
  },
  {
    key: ADD_FORMS.appointment,
    label: quickActions.appointment,
    icon: CalendarPlus,
    href: addTo(APPOINTMENTS, ADD_FORMS.appointment),
    access: "appointments.create",
  },
  {
    key: ADD_FORMS.patient,
    label: quickActions.patient,
    icon: UserPlus,
    href: addTo(PATIENTS, ADD_FORMS.patient),
    access: "patients.create",
  },
  {
    key: ADD_FORMS.payment,
    label: quickActions.payment,
    icon: IndianRupee,
    href: addTo(BILLING, ADD_FORMS.payment),
    access: "payments.create",
  },
  {
    key: ADD_FORMS.expense,
    label: quickActions.expense,
    icon: Wallet,
    href: addTo(EXPENSES, ADD_FORMS.expense),
    access: "expenses.create",
  },
];

/** The quick adds someone may make. */
export function quickAddFor(member: Member): QuickAddItem[] {
  return QUICK_ADD.filter((item) => hasAccess(member, item.access));
}

/** A new clinic's first step on Home (plan §17; D348, D352): where it is taken, and who may take it there. */
export interface GettingStartedStep {
  id: keyof typeof UI_TEXT.home.gettingStarted.steps;
  href: string;
  access: Permission;
}

export const GETTING_STARTED: readonly GettingStartedStep[] = [
  { id: "prices", href: `${SETTINGS_ROUTE}/${PRICE_LIST_SLUG}`, access: "settings.manage" },
  { id: "team", href: TEAM_ROUTE, access: "team.manage" },
  { id: "patient", href: addTo(PATIENTS, ADD_FORMS.patient), access: "patients.create" },
];
