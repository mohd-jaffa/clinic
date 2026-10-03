import { describe, expect, it } from "vitest";

import { UI_TEXT } from "@/constants/messages";
import {
  ADD_PARAM,
  ALL_NAV,
  BOTTOM_NAV,
  isActivePath,
  MORE_NAV,
  NAV_GROUPS,
  placesFor,
  QUICK_ADD,
  quickAddFor,
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
      "/follow-ups": "visits.view",
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
    expect(ids(placesFor(receptionist, ALL_NAV))).toEqual(["home", "queue", "appointments", "patients", "settings"]);
    expect(ids(placesFor({ role: "STAFF", permissions: [] }, MORE_NAV))).toEqual(["settings"]);
  });

  it("are current on their own screen and the screens within it", () => {
    expect(isActivePath("/patients", "/patients")).toBe(true);
    expect(isActivePath("/patients", "/patients/p-1")).toBe(true);
    expect(isActivePath("/patients", "/patients-archive")).toBe(false);
    expect(isActivePath("/settings", "/settings/account")).toBe(true);
    expect(isActivePath("/home", "/queue")).toBe(false);
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
