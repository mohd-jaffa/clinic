import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ChartColumn,
  Footprints,
  House,
  IdCard,
  IndianRupee,
  ListOrdered,
  ReceiptIndianRupee,
  Settings,
  UserPlus,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { UI_TEXT } from "./messages";
import { hasAccess, ROUTE_ACCESS, type Permission, type RouteAccess } from "./permissions";
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

const HOME: NavItem = { id: "home", label: places.home, icon: House, href: HOME_ROUTE, access: ROUTE_ACCESS.member };
const QUEUE: NavItem = {
  id: "queue",
  label: places.queue,
  icon: ListOrdered,
  href: "/queue",
  access: "appointments.view",
};
const APPOINTMENTS: NavItem = {
  id: "appointments",
  label: places.appointments,
  icon: CalendarDays,
  href: "/appointments",
  access: "appointments.view",
  hint: hints.appointments,
};
const PATIENTS: NavItem = {
  id: "patients",
  label: places.patients,
  icon: UsersRound,
  href: "/patients",
  access: "patients.view",
};
const FOLLOW_UPS: NavItem = {
  id: "followUps",
  label: places.followUps,
  icon: CalendarClock,
  href: "/follow-ups",
  access: "visits.view",
  hint: hints.followUps,
};
const BILLING: NavItem = {
  id: "billing",
  label: places.billing,
  icon: ReceiptIndianRupee,
  href: "/billing",
  access: "payments.view",
  hint: hints.billing,
};
const EXPENSES: NavItem = {
  id: "expenses",
  label: places.expenses,
  icon: Wallet,
  href: "/expenses",
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
const TEAM: NavItem = {
  id: "team",
  label: places.team,
  icon: IdCard,
  href: "/team",
  access: "team.manage",
  hint: hints.team,
};
export const SETTINGS_ROUTE = "/settings";
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

type Member = Parameters<typeof hasAccess>[0];

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
