import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { issueBill } from "@/features/billing/api";
import { recordPayment } from "@/features/billing/payments";
import { createExpense } from "@/features/expenses/api";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
import { formatLongDate } from "@/lib/format/date";
import { billSchema, expenseSchema, paymentSchema, walkInSchema } from "@/lib/validation";
import { expectAccessible, greetingFor } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Home (plan §17, §32.1; R10.2, D345 – D353), at a phone's width and a
 * desktop's. A new clinic's owner finds the getting-started steps, ticked
 * as the prices are set, until the first patient is added. Then an owner's
 * day: the greeting, today's appointments beside the date, Waiting and Seen
 * on the land; Collected today and Outstanding; Maya's queue, To bill,
 * tomorrow, who owes, the last payment and expense — a row opening the
 * patient's profile. The front desk's Home holds what reception may see,
 * and no money figures or expenses. Each screen checked by axe, nothing
 * wider than the screen.
 */
test.afterAll(removeAll);

const { home: words } = UI_TEXT;
/** Reception's preset (plan §8.3). */
const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "payments.view",
  "payments.create",
];

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const fitsTheScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
const section = (page: Page, title: string) => page.getByRole("region", { name: new RegExp(`^${title}`) });

test("a new clinic's Home: the getting-started steps, ticked as they are done, until the first patient", async ({
  page,
}) => {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  await signIn(page, clinic.owner.email, clinic.owner.password);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: greetingFor("Asha") })).toBeVisible();
  const steps = page.getByRole("region", { name: words.gettingStarted.title });
  await expect(steps.getByText(words.gettingStarted.hint("Smile Care"))).toBeVisible();
  await expect(steps.getByText(words.gettingStarted.done)).toHaveCount(0);
  await expect(steps.getByRole("link", { name: words.gettingStarted.steps.prices.label })).toHaveAttribute(
    "href",
    "/settings/price-list",
  );
  await expect(page.getByText(words.waiting)).toHaveCount(0);
  await fitsTheScreen(page);
  await expectAccessible(page);

  // The Consultation priced: its step ticked.
  await admin().from("services").update({ price_paise: 50_000 }).eq("clinic_id", clinic.clinicId);
  await page.reload();
  await expect(steps.getByRole("listitem").filter({ hasText: words.gettingStarted.steps.prices.label })).toContainText(
    words.gettingStarted.done,
  );

  // The first patient, from its step: Home fills with the day.
  await steps.getByRole("link", { name: words.gettingStarted.steps.patient.label }).click();
  await expect(page).toHaveURL(/\/patients\?add=patient$/);
  const { error } = await clinic.owner.tenant.supabase.rpc("create_patient", {
    p_patient: { full_name: "Rohan Mehta", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
    p_idempotency_key: randomUUID(),
  });
  expect(error).toBeNull();
  await page.goto("/home");
  await expect(page.getByRole("region", { name: words.gettingStarted.title })).toHaveCount(0);
  await expect(section(page, words.queue.title)).toContainText(words.queue.empty);
  await expectAccessible(page);
});

test("an owner's day on Home, and the front desk's", async ({ page, browser }) => {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const [maya, desk] = await Promise.all([
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "visits.view"] }),
    addMember(clinic.clinicId, { permissions: DESK }),
  ]);
  await Promise.all([
    admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId),
    admin().from("profiles").update({ full_name: "Priya Nair" }).eq("id", desk.userId),
    admin().from("doctors").update({ consultation_fee_paise: 80_000 }).eq("member_id", maya.memberId),
  ]);
  const [{ data: doctor }, { data: type }, { data: consultation }, { data: supplies }] = await Promise.all([
    admin().from("doctors").select("id").eq("member_id", maya.memberId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
    admin().from("services").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
    admin().from("expense_categories").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Supplies").single(),
  ]);
  const patient = async (fullName: string) => {
    const { data, error } = await desk
      .tenant!.supabase.rpc("create_patient", {
        p_patient: { full_name: fullName, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "FEMALE" },
        p_idempotency_key: randomUUID(),
      })
      .single<{ patient_id: string }>();
    if (error) throw error;
    return data.patient_id;
  };
  const walkIn = (patientId: string) =>
    addWalkIn(
      desk.tenant!,
      walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId: doctor!.id, typeId: type!.id }),
      randomUUID(),
    );
  const seen = async (patientId: string) => {
    const arrival = await walkIn(patientId);
    const { visitId } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
    await markDone(desk.tenant!, { appointmentId: arrival.id });
    return visitId;
  };
  const [anita, rohan, kiran, meera] = await Promise.all(
    ["Anita Das", "Rohan Mehta", "Kiran Shah", "Meera Pillai"].map(patient),
  );
  // Anita seen and billed ₹800, unpaid; Rohan seen, waiting in To bill; Kiran waiting for Maya.
  const anitaVisit = await seen(anita);
  await issueBill(
    desk.tenant!,
    billSchema.parse({
      patientId: anita,
      visitId: anitaVisit,
      appointmentId: null,
      discount: { kind: "NONE" },
      notes: "",
      collect: { on: false },
      lines: [{ kind: "SERVICE", serviceId: consultation!.id, treatmentId: null, quantity: 1, price: "800" }],
    }),
    randomUUID(),
  );
  await seen(rohan);
  const { token } = await walkIn(kiran);
  // Meera pays ₹500 ahead, and is booked for tomorrow at 10.
  await recordPayment(
    desk.tenant!,
    paymentSchema.parse({
      patientId: meera,
      kind: "PAYMENT",
      amount: "500",
      paidOn: todayKey(),
      method: "CASH",
      reference: "",
      note: "",
    }),
    randomUUID(),
  );
  const { error: unbooked } = await desk.tenant!.supabase.rpc("create_appointment", {
    p_appointment: {
      patient_id: meera,
      doctor_id: doctor!.id,
      appointment_type_id: type!.id,
      scheduled_at: dayHour(addDaysKey(todayKey(), 1), 10),
      duration_minutes: 15,
    },
    p_idempotency_key: randomUUID(),
  });
  expect(unbooked).toBeNull();
  await createExpense(
    clinic.owner.tenant,
    expenseSchema.parse({
      categoryId: supplies!.id,
      amount: "250",
      day: todayKey(),
      method: "CASH",
      description: "Gauze",
    }),
    randomUUID(),
    "req_home",
  );

  // The owner's Home: the land, the money, the sections.
  await signIn(page, clinic.owner.email, clinic.owner.password);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: greetingFor("Asha") })).toBeVisible();
  await expect(page.getByText(`${formatLongDate(todayKey())} · ${words.appointments(3)}`)).toBeVisible();
  await expect(page.getByRole("link", { name: words.waiting })).toHaveAttribute("href", "/queue");
  const money = page.getByRole("region", { name: words.money });
  await expect(money).toContainText("₹500");
  await expect(money).toContainText("₹800");
  const queue = section(page, words.queue.title);
  await expect(queue.getByRole("heading", { name: `Maya Rao · ${words.queue.doctorLine(0, 1)}` })).toBeVisible();
  await expect(queue.getByRole("listitem")).toContainText(String(token).padStart(2, "0"));
  await expect(section(page, words.toBill.title).getByRole("link", { name: "Rohan Mehta" })).toBeVisible();
  await expect(section(page, words.followUps.title)).toContainText(words.followUps.empty);
  await expect(section(page, words.upcoming.title)).toContainText("Meera Pillai");
  await expect(section(page, words.owing.title)).toContainText("Anita Das");
  await expect(section(page, words.payments.title)).toContainText("Paid ₹500 · Cash");
  await expect(section(page, words.expenses.title)).toContainText("Gauze");
  await fitsTheScreen(page);
  await expectAccessible(page);

  // A row opens the patient's profile (D351).
  await queue.getByRole("link", { name: "Kiran Shah" }).click();
  await expect(page).toHaveURL(new RegExp(`/patients/${kiran}$`));

  // The front desk's Home: what reception sees, and no money figures or expenses.
  const front = await browser.newContext({ viewport: page.viewportSize()! });
  const frontPage = await front.newPage();
  await signIn(frontPage, desk.email, desk.password);
  await frontPage.goto("/home");
  await expect(frontPage.getByRole("heading", { level: 1, name: greetingFor("Priya") })).toBeVisible();
  await expect(section(frontPage, words.toBill.title)).toBeVisible();
  await expect(section(frontPage, words.owing.title)).toBeVisible();
  await expect(frontPage.getByRole("region", { name: words.money })).toHaveCount(0);
  await expect(section(frontPage, words.expenses.title)).toHaveCount(0);
  await fitsTheScreen(frontPage);
  await expectAccessible(frontPage);
  await front.close();
});
