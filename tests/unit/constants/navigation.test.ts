import { describe, expect, it } from "vitest";

import { UI_TEXT } from "@/constants/messages";
import {
  ADD_PARAM,
  ALL_NAV,
  BILL_FROM,
  billRoute,
  BOTTOM_NAV,
  isActivePath,
  memberRoute,
  MORE_NAV,
  newBillRoute,
  NAV_GROUPS,
  placesFor,
  PLAN_ROUTE,
  QUICK_ADD,
  quickAddFor,
  SETTINGS_GROUPS,
  settingsFor,
  TEAM_ROUTE,
  VISIT_FROM,
  visitRoute,
} from "@/constants/navigation";
import { PERMISSIONS } from "@/constants/permissions";

const owner = { role: "OWNER" as const, permissions: [...PERMISSIONS] };
const receptionist = {
  role: "STAFF" as const,
  permissions: ["patients.view", "patients.create", "appointments.view"] as const,
};
const ids = (items: readonly { id?: string; key?: string }[]) => items.map((item) => item.id ?? item.key);

describe("the places (plan §31.1)", () => {
  it("are the plan's ten, in its order and its three groups", () => {
    expect(NAV_GROUPS.map(ids)).toEqual([
      ["home", "queue", "appointments", "patients", "followUps"],
      ["billing", "expenses", "reports"],
      ["team", "settings"],
    ]);
    expect(ALL_NAV.map((item) => item.label)).toEqual(Object.values(UI_TEXT.nav.places));
  });

  it("each name who may go there, as their screens do (plan §31.2)", () => {
    expect(Object.fromEntries(ALL_NAV.map((item) => [item.href, item.access]))).toEqual({
      "/home": "MEMBER",
      "/queue": "appointments.view",
      "/appointments": "appointments.view",
      "/patients": "patients.view",
      "/follow-ups": ["appointments.view", "visits.view"],
      "/billing": "payments.view",
      "/expenses": "expenses.view",
      "/reports": "reports.view",
      "/team": "team.manage",
      "/settings": "MEMBER",
    });
  });

  it("put Home, Queue and Patients in the phone's bar, and everything else behind More, each with a line", () => {
    expect(ids(BOTTOM_NAV.start)).toEqual(["home", "queue"]);
    expect(ids(BOTTOM_NAV.end)).toEqual(["patients"]);
    expect(ids(MORE_NAV)).toEqual(["appointments", "followUps", "billing", "expenses", "reports", "team", "settings"]);
    expect(MORE_NAV.every((item) => item.hint)).toBe(true);
  });

  it("are shown only to those who may open them", () => {
    expect(placesFor(owner, ALL_NAV)).toEqual(ALL_NAV);
    expect(ids(placesFor(receptionist, ALL_NAV))).toEqual([
      "home",
      "queue",
      "appointments",
      "patients",
      "followUps",
      "settings",
    ]);
    expect(ids(placesFor({ role: "STAFF", permissions: [] }, MORE_NAV))).toEqual(["settings"]);
  });

  it("are current on their own screen and the screens within it", () => {
    expect(isActivePath("/patients", "/patients")).toBe(true);
    expect(isActivePath("/patients", "/patients/p-1")).toBe(true);
    expect(isActivePath("/patients", "/patients-archive")).toBe(false);
    expect(isActivePath("/settings", "/settings/account")).toBe(true);
    expect(isActivePath("/home", "/queue")).toBe(false);
  });

  it("give each member a page within the team's (D94)", () => {
    expect(memberRoute("m-2")).toBe(`${TEAM_ROUTE}/m-2`);
    expect(isActivePath(TEAM_ROUTE, memberRoute("m-2"))).toBe(true);
  });
});

describe("quick add (D67)", () => {
  it("goes to each action's own screen with its form open", () => {
    expect(QUICK_ADD.map((item) => [item.label, item.href])).toEqual([
      ["Walk-in", `/queue?${ADD_PARAM}=walk-in`],
      ["Appointment", `/appointments?${ADD_PARAM}=appointment`],
      ["Patient", `/patients?${ADD_PARAM}=patient`],
      ["Payment", `/billing?${ADD_PARAM}=payment`],
      ["Expense", `/expenses?${ADD_PARAM}=expense`],
    ]);
  });

  it("offers each action only to those who may make it", () => {
    expect(quickAddFor(owner)).toEqual(QUICK_ADD);
    expect(ids(quickAddFor(receptionist))).toEqual(["patient"]);
    expect(
      quickAddFor({ role: "DOCTOR", permissions: ["appointments.create", "expenses.create"] }).map((a) => a.key),
    ).toEqual(["walk-in", "appointment", "expense"]);
    expect(quickAddFor({ role: "STAFF", permissions: [] })).toEqual([]);
  });
});

describe("the Settings index (plan §31.2, D71)", () => {
  it("holds the clinic's setup, then the plan and its records, each row at its screen", () => {
    expect(SETTINGS_GROUPS.map((group) => [group.id, group.items.map((item) => item.href)])).toEqual([
      [
        "clinic",
        [
          "/settings/clinic",
          "/settings/price-list",
          "/settings/appointment-types",
          "/settings/expense-categories",
          "/settings/closures",
        ],
      ],
      [
        "owner",
        ["/settings/plan", "/settings/activity", "/settings/import", "/settings/export", "/settings/delete-clinic"],
      ],
    ]);
  });

  it("asks settings.manage of the clinic's setup and the owner of the rest, as their screens do", () => {
    const [clinic, owner] = SETTINGS_GROUPS;
    expect(new Set(clinic.items.map((item) => item.access))).toEqual(new Set(["settings.manage"]));
    expect(new Set(owner.items.map((item) => item.access))).toEqual(new Set(["OWNER"]));
  });

  it("leads to the Plan screen the plan banner's How to renew opens (D74)", () => {
    expect(SETTINGS_GROUPS[1].items[0].href).toBe(PLAN_ROUTE);
  });

  it("marks only Delete clinic as what cannot be undone", () => {
    const marked = SETTINGS_GROUPS.flatMap((group) => group.items).filter((item) => item.attention);
    expect(ids(marked)).toEqual(["deleteClinic"]);
  });

  it("shows each person the groups they may open, and drops a group left empty", () => {
    expect(settingsFor(owner, SETTINGS_GROUPS).map((group) => group.id)).toEqual(["clinic", "owner"]);
    const manager = { role: "STAFF" as const, permissions: [...PERMISSIONS] };
    expect(settingsFor(manager, SETTINGS_GROUPS).map((group) => group.id)).toEqual(["clinic"]);
    expect(settingsFor(receptionist, SETTINGS_GROUPS)).toEqual([]);
  });
});

describe("a visit's screen (D195, D230)", () => {
  it("is the visit's own address, saying when it was opened from the patient's profile", () => {
    expect(visitRoute("v-1")).toBe("/visits/v-1");
    expect(visitRoute("v-1", VISIT_FROM.patient)).toBe("/visits/v-1?from=patient");
  });
});

describe("a new bill (plan §15.2, D313)", () => {
  it("names what it bills, or no one yet, and Billing when it was started there", () => {
    expect(newBillRoute()).toBe("/billing/new");
    expect(newBillRoute({ visit: "v-1" })).toBe("/billing/new?visit=v-1");
    expect(newBillRoute({ patient: "p-1" }, BILL_FROM.billing)).toBe("/billing/new?patient=p-1&from=billing");
    expect(newBillRoute(undefined, BILL_FROM.billing)).toBe("/billing/new?from=billing");
    expect(newBillRoute({ visit: "v-1" }, BILL_FROM.patient)).toBe("/billing/new?visit=v-1&from=patient");
    expect(newBillRoute({ visit: "v-1" }, undefined, "b-1")).toBe("/billing/new?visit=v-1&reissue=b-1");
  });

  it("names a bill's page, and the profile it was opened from (D314, D325)", () => {
    expect(billRoute("b-1")).toBe("/bills/b-1");
    expect(billRoute("b-1", BILL_FROM.patient)).toBe("/bills/b-1?from=patient");
  });
});
