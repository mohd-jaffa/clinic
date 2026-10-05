import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST as archiveRoute } from "@/app/api/patients/[id]/archive/route";
import { PATCH as alertRoute } from "@/app/api/patients/[id]/alerts/[alertId]/route";
import { GET as alertsRoute, POST as addAlertRoute } from "@/app/api/patients/[id]/alerts/route";
import { POST as restoreRoute } from "@/app/api/patients/[id]/restore/route";
import { GET as patientRoute, PATCH as changeRoute } from "@/app/api/patients/[id]/route";
import { POST as importMatchesRoute } from "@/app/api/patients/import/matches/route";
import { GET as importLimitsRoute, POST as importRoute } from "@/app/api/patients/import/route";
import { POST as matchesRoute } from "@/app/api/patients/matches/route";
import { POST as createRoute } from "@/app/api/patients/route";
import { POST as searchRoute } from "@/app/api/patients/search/route";
import type { Permission } from "@/constants/permissions";
import { IDEMPOTENCY_HEADER } from "@/lib/api/client";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Who reaches a patient, through every patients route (plan §8, §34; R4.7):
 * each member sends their own token to the real handlers, so the route
 * guard, the feature function and RLS answer together. Staff without
 * `patients.view` are refused by every route and read nothing at the
 * database either; `patients.view` alone reads and changes nothing; a doctor
 * reaches only their own patients (D3); another clinic reaches none; and an
 * import is the owner's alone (plan §10.5).
 */
type Member = SignedIn & { memberId: string };
type Answer = { status: number; body: { data?: unknown; error?: { code: string } } };

const DOCTOR: Permission[] = ["patients.view", "patients.create", "patients.edit", "visits.view", "visits.edit"];
const PHONE = "+919812345678";

let clinic: TestClinic;
let other: TestClinic;
let doctorA: Member;
let doctorB: Member;
let frontDesk: Member;
let bookkeeper: Member;
/** Doctor A's patient, and doctor B's — on one family mobile — with an alert on B's. */
let mine: string;
let theirs: string;
let theirAlert: string;

const at = <P extends string>(params: Record<P, string>) => ({ params: Promise.resolve(params) });

/** A route handler answering one member's request, as their browser sends it. */
async function ask(
  member: SignedIn,
  handler: (request: Request) => Promise<Response>,
  { method = "POST", body, key }: { method?: string; body?: unknown; key?: string } = {},
): Promise<Answer> {
  const headers: Record<string, string> = { authorization: `Bearer ${member.session.accessToken}` };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (key) headers[IDEMPOTENCY_HEADER] = key;
  const request = new Request("http://localhost/api/patients", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handler(request);
  return { status: response.status, body: await response.json() };
}

const typed = { fullName: "Asha Rao", phone: "98123 45678", born: { as: "AGE", years: "30" }, gender: "FEMALE" };

/** Every patients route, asked of one patient (and one of their alerts) by one member. */
const everyRoute = (member: SignedIn, patient: string, alert: string) => ({
  create: () => ask(member, createRoute, { body: typed, key: randomUUID() }),
  search: () => ask(member, searchRoute, { body: { search: "", tab: "ALL" } }),
  matches: () => ask(member, matchesRoute, { body: { phone: PHONE.slice(3) } }),
  read: () => ask(member, (request) => patientRoute(request, at({ id: patient })), { method: "GET" }),
  change: () =>
    ask(member, (request) => changeRoute(request, at({ id: patient })), {
      method: "PATCH",
      body: { fullName: "Changed" },
    }),
  archive: () => ask(member, (request) => archiveRoute(request, at({ id: patient }))),
  restore: () => ask(member, (request) => restoreRoute(request, at({ id: patient }))),
  alerts: () => ask(member, (request) => alertsRoute(request, at({ id: patient })), { method: "GET" }),
  addAlert: () =>
    ask(member, (request) => addAlertRoute(request, at({ id: patient })), {
      body: { kind: "ALLERGY", label: `Latex ${randomUUID()}` },
    }),
  changeAlert: () =>
    ask(member, (request) => alertRoute(request, at({ id: patient, alertId: alert })), {
      method: "PATCH",
      body: { note: "Changed" },
    }),
});

const named = (answer: Answer) => (answer.body.data as { items: { name: string }[] }).items.map(({ name }) => name);
const matched = (answer: Answer) => (answer.body.data as { name: string }[]).map(({ name }) => name);

async function addPatient(fullName: string, doctorId: string) {
  const { data, error } = await clinic.owner.tenant.supabase
    .rpc("create_patient", {
      p_patient: {
        full_name: fullName,
        phone: PHONE,
        date_of_birth: "1990-04-12",
        gender: "MALE",
        assigned_doctor_id: doctorId,
      },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  return data.patient_id;
}

const doctorIdOf = async (memberId: string) => {
  const { data } = await admin().from("doctors").select("id").eq("member_id", memberId).single();
  return data!.id as string;
};

beforeAll(async () => {
  [clinic, other] = await Promise.all([registerClinic(), registerClinic()]);
  [doctorA, doctorB, frontDesk, bookkeeper] = await Promise.all([
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: DOCTOR }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: DOCTOR }),
    addMember(clinic.clinicId, { permissions: ["patients.view"] }),
    addMember(clinic.clinicId, { permissions: ["expenses.view"] }),
  ]);
  mine = await addPatient("Mine Patient", await doctorIdOf(doctorA.memberId));
  theirs = await addPatient("Their Patient", await doctorIdOf(doctorB.memberId));
  const { data: alert, error } = await clinic.owner.tenant.supabase
    .from("patient_alerts")
    .insert({ clinic_id: clinic.clinicId, patient_id: theirs, kind: "ALLERGY", label: "Penicillin" })
    .select("id")
    .single();
  if (error) throw error;
  theirAlert = alert.id as string;
});

afterAll(removeAll);

describe("staff without patients.view", () => {
  it("are refused by every patients route", async () => {
    for (const [route, send] of Object.entries(everyRoute(bookkeeper, theirs, theirAlert))) {
      const answer = await send();
      expect(answer.status, route).toBe(403);
      expect(answer.body.error?.code, route).toBe("AUTH_PERMISSION_DENIED");
    }
  });

  it("read nothing of a patient straight at the database either", async () => {
    const { supabase } = bookkeeper.tenant!;
    expect((await supabase.from("patients").select("id")).data).toEqual([]);
    expect((await supabase.from("patient_alerts").select("id")).data).toEqual([]);
    const { data: found } = await supabase.rpc("search_patients", {
      p_words: null,
      p_digits: null,
      p_number: null,
      p_archived: false,
      p_offset: 0,
      p_limit: 20,
    });
    expect(found).toEqual([]);
  });
});

describe("patients.view alone", () => {
  it("reads patients — the list, a mobile's family, a profile", async () => {
    const routes = everyRoute(frontDesk, theirs, theirAlert);
    expect(named(await routes.search())).toEqual(["Their Patient", "Mine Patient"]);
    expect(matched(await routes.matches())).toEqual(["Their Patient", "Mine Patient"]);
    expect(await routes.read()).toMatchObject({ status: 200, body: { data: { name: "Their Patient" } } });
  });

  it("adds, changes and archives none, and reads no alerts (visits.view)", async () => {
    const routes = everyRoute(frontDesk, theirs, theirAlert);
    for (const route of ["create", "change", "archive", "restore", "alerts", "addAlert", "changeAlert"] as const) {
      expect((await routes[route]()).status, route).toBe(403);
    }
  });
});

describe("the doctor scope, through every route (D3)", () => {
  it("lists a doctor only their own, in the list and among a mobile's family", async () => {
    const routes = everyRoute(doctorA, mine, theirAlert);
    expect(named(await routes.search())).toEqual(["Mine Patient"]);
    expect(matched(await routes.matches())).toEqual(["Mine Patient"]);
  });

  it("adds a patient, and reads and changes their own", async () => {
    const routes = everyRoute(doctorA, mine, theirAlert);
    expect(await routes.create()).toMatchObject({ status: 201, body: { data: { name: "Asha Rao" } } });
    expect(await routes.read()).toMatchObject({ status: 200, body: { data: { name: "Mine Patient" } } });
    expect((await routes.alerts()).status).toBe(200);
    expect((await routes.addAlert()).status).toBe(201);
    expect(await routes.change()).toMatchObject({ status: 200, body: { data: { name: "Changed" } } });
  });

  it("reaches none of another doctor's: not found, through every route that names one", async () => {
    const routes = everyRoute(doctorA, theirs, theirAlert);
    for (const route of ["read", "change", "archive", "restore", "alerts", "addAlert", "changeAlert"] as const) {
      const answer = await routes[route]();
      expect(answer.status, route).toBe(404);
      expect(answer.body.error?.code, route).toBe("RECORD_NOT_FOUND");
    }
    const { data } = await admin().from("patients").select("full_name, archived_at").eq("id", theirs).single();
    expect(data).toEqual({ full_name: "Their Patient", archived_at: null });
  });
});

describe("another clinic, through every route", () => {
  it("finds none of the clinic's patients, and reaches none it names", async () => {
    const routes = everyRoute(other.owner, theirs, theirAlert);
    expect(named(await routes.search())).toEqual([]);
    expect(matched(await routes.matches())).toEqual([]);
    for (const route of ["read", "change", "archive", "restore", "alerts", "addAlert", "changeAlert"] as const) {
      expect((await routes[route]()).status, route).toBe(404);
    }
    const { data } = await admin().from("patient_alerts").select("note").eq("id", theirAlert).single();
    expect(data).toEqual({ note: null });
  });
});

describe("an import, the owner's alone (plan §10.5)", () => {
  const importRoutes = (member: SignedIn) => ({
    limits: () => ask(member, importLimitsRoute, { method: "GET" }),
    matches: () => ask(member, importMatchesRoute, { body: { phones: [PHONE.slice(3)] } }),
    send: () =>
      ask(member, importRoute, {
        body: { rows: [{ ...typed, fullName: "Imported Patient", key: randomUUID() }] },
      }),
  });

  it("is refused to every member but the owner, doctors and those who add patients included", async () => {
    for (const member of [bookkeeper, frontDesk, doctorA]) {
      for (const [route, send] of Object.entries(importRoutes(member))) {
        expect((await send()).status, route).toBe(403);
      }
    }
  });

  it("answers the owner its limits and the clinic's patients on a mobile, and imports a batch", async () => {
    const routes = importRoutes(clinic.owner);
    expect(await routes.limits()).toMatchObject({ status: 200, body: { data: { maxRows: expect.any(Number) } } });
    // Everyone on the family mobile, whichever doctor is theirs.
    expect(matched(await routes.matches())).toEqual(expect.arrayContaining(["Their Patient", "Asha Rao"]));
    expect(await routes.send()).toMatchObject({ status: 200, body: { data: { imported: 1, added: 1 } } });
  });
});
