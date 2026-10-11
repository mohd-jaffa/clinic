import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { createPatient } from "@/features/patients/api";
import { addDaysKey, dayHour, minutesOfDay, todayKey } from "@/lib/dates/calendar";
import { formatHour } from "@/lib/format/date";
import { patientSchema } from "@/lib/validation";
import { expectAccessible, inviteMember, joinByInvite } from "@tests/support/e2e";
import { aMobileNumber, admin, anEmail, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Phase 5's journey (plan §34.4's front desk; R5.6, D177, D178): the owner
 * invites a receptionist and a doctor, and each joins by their link. The
 * receptionist adds a patient — told who else is on the mobile — books them
 * with the doctor for later today, and a second booking into that time is
 * refused, naming it. She adds a walk-in, given #1, and marks the booked
 * patient Arrived, given #2 — while the doctor's own queue, open on their
 * device, shows the walk-in within its refresh. The doctor cannot open a
 * patient booked only with another doctor, and a second clinic reaches none
 * of it. At a phone's width and a desktop's, each screen checked by axe.
 */
test.afterAll(removeAll);

const { patients, appointments, queue } = UI_TEXT;

/** Later today on the clinic's 5-minute steps, ten minutes on — or none so late in the day. */
function laterToday(): { hour: string; minute: string } | null {
  const minutes = Math.ceil((minutesOfDay() + 10) / 5) * 5;
  if (minutes >= 24 * 60) return null;
  return { hour: String(Math.floor(minutes / 60)).padStart(2, "0"), minute: String(minutes % 60).padStart(2, "0") };
}

async function pickTime(page: Page, sheet: ReturnType<Page["getByRole"]>, at: { hour: string; minute: string }) {
  await sheet.getByRole("combobox", { name: `${appointments.timeLabel}, ${appointments.hourLabel}` }).click();
  await page.getByRole("option", { name: formatHour(at.hour), exact: true }).click();
  await sheet.getByRole("combobox", { name: `${appointments.timeLabel}, ${appointments.minuteLabel}` }).click();
  await page.getByRole("option", { name: `:${at.minute}`, exact: true }).click();
}

const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });

test("the front desk adds, books, adds a walk-in and arrives a patient; the doctor and a second clinic see only theirs", async ({
  page,
  browser,
}) => {
  const at = laterToday();
  test.skip(at === null, "the journey books for later today, and the day is nearly over");

  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const family = aMobileNumber();
  const typed = (fullName: string, phone: string) =>
    patientSchema.parse({ fullName, phone, born: { as: "AGE", years: "41" }, gender: "MALE" });
  await createPatient(clinic.owner.tenant, typed("Kiran Das", family), randomUUID());
  // Sunil Nair has only ever been booked with Asha Menon.
  const sunil = await createPatient(clinic.owner.tenant, typed("Sunil Nair", aMobileNumber()), randomUUID());
  const [{ data: asha }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id").eq("clinic_id", clinic.clinicId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  const { error } = await clinic.owner.tenant.supabase.rpc("create_appointment", {
    p_appointment: {
      patient_id: sunil.id,
      doctor_id: asha!.id,
      appointment_type_id: type!.id,
      scheduled_at: dayHour(addDaysKey(todayKey(), 1), 10),
      duration_minutes: 15,
    },
    p_idempotency_key: randomUUID(),
  });
  expect(error).toBeNull();

  // The owner invites a receptionist and a doctor; each joins on a device of their own.
  expect(
    (
      await page.request.post("/api/auth/login", {
        data: { identifier: clinic.owner.email, password: clinic.owner.password },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/team");
  const receptionist = { name: "Meera Pillai", email: anEmail() };
  const doctor = { name: "Rahul Nair", email: anEmail(), doctor: true };
  await inviteMember(page, receptionist);
  await inviteMember(page, doctor);
  const desk = await joinByInvite(browser, page, receptionist.email);
  const rahul = await joinByInvite(browser, page, doctor.email);

  // The doctor keeps their own queue open.
  await rahul.goto("/queue");
  await expect(rahul.getByRole("radio", { name: "Rahul Nair" })).toBeChecked();

  // The receptionist adds a patient, told who else is on the mobile.
  await desk.goto("/patients?add=patient");
  const adding = desk.getByRole("dialog", { name: patients.addTitle });
  await adding.getByRole("textbox", { name: /^Full name/ }).fill("Anita Rao");
  await adding.getByRole("textbox", { name: /^Mobile/ }).fill(family);
  await expect(adding.getByRole("region", { name: patients.matchesTitle(1) })).toContainText("Kiran Das");
  await adding.getByRole("radio", { name: patients.bornAs.AGE }).click();
  await adding.getByRole("textbox", { name: /^Age in years/ }).fill("38");
  await adding.getByRole("radio", { name: "Female", exact: true }).click();
  await expectAccessible(desk);
  await adding.getByRole("button", { name: patients.add }).click();
  await expect(desk.getByRole("heading", { level: 1, name: "Anita Rao" })).toBeVisible();

  // She books Anita with the doctor for later today; a second booking into that time is refused.
  const book = async (name: string) => {
    await desk.goto("/appointments?add=appointment");
    const sheet = desk.getByRole("dialog", { name: appointments.bookTitle });
    await sheet.getByRole("searchbox").fill(name.split(" ")[0]);
    await sheet.getByRole("button", { name }).click();
    await sheet.getByRole("combobox", { name: /^Doctor/ }).click();
    await desk.getByRole("option", { name: "Rahul Nair" }).click();
    await pickTime(desk, sheet, at!);
    await sheet.getByRole("button", { name: appointments.book }).click();
    return sheet;
  };
  const first = await book("Anita Rao");
  await expect(first).toBeHidden();
  await expect(notice(desk, "Booked Anita Rao")).toBeVisible();
  const second = await book("Kiran Das");
  const taken = desk.getByRole("alertdialog", { name: /^Rahul Nair is booked / });
  await expect(taken).toBeVisible();
  await expectAccessible(desk);
  await taken.getByRole("button", { name: UI_TEXT.actions.close }).click();
  await expect(second).toBeVisible();

  // She adds Kiran as a walk-in — #1 — and the doctor's queue shows him within its refresh.
  await desk.goto(`/queue?add=walk-in`);
  const walking = desk.getByRole("dialog", { name: queue.walkInTitle });
  await walking.getByRole("searchbox").fill("Kiran");
  await walking.getByRole("button", { name: "Kiran Das" }).click();
  await walking.getByRole("combobox", { name: /^Doctor/ }).click();
  await desk.getByRole("option", { name: "Rahul Nair" }).click();
  await walking.getByRole("button", { name: queue.addWalkIn }).click();
  await expect(notice(desk, queue.tokenGiven("Kiran Das", 1, "Rahul Nair"))).toBeVisible();
  await expect(rahul.getByRole("list", { name: queue.waiting })).toContainText("Kiran Das", { timeout: 20_000 });

  // Anita arrives: #2.
  await desk.getByRole("button", { name: queue.markArrived("Anita Rao") }).click();
  await expect(notice(desk, queue.tokenGiven("Anita Rao", 2, "Rahul Nair"))).toBeVisible();
  const waiting = desk.getByRole("list", { name: queue.waiting });
  await expect(waiting.getByRole("listitem")).toHaveCount(2);
  await expect(waiting.getByRole("listitem").first()).toContainText("Kiran Das");
  await expectAccessible(desk);

  // The doctor cannot open a patient booked only with another doctor.
  await rahul.goto("/patients");
  await rahul.getByRole("searchbox", { name: patients.searchPlaceholder }).fill("Sunil");
  await expect(rahul.getByText(patients.noMatches("Sunil"))).toBeVisible();
  await rahul.goto(`/patients/${sunil.id}`);
  await expect(rahul.getByText(ERROR_MESSAGES.RECORD_NOT_FOUND)).toBeVisible();
  await expectAccessible(rahul);

  // A second clinic reaches none of it.
  const other = await registerClinic({ fullName: "Ravi Kumar" });
  const elsewhere = await browser.newContext();
  const login = await elsewhere.request.post(`${new URL(page.url()).origin}/api/auth/login`, {
    data: { identifier: other.owner.email, password: other.owner.password },
  });
  expect(login.ok()).toBe(true);
  const { data: anita } = await admin()
    .from("appointments")
    .select("id")
    .eq("clinic_id", clinic.clinicId)
    .eq("source", "BOOKED")
    .eq("status", "ARRIVED")
    .single();
  const origin = new URL(page.url()).origin;
  expect((await elsewhere.request.get(`${origin}/api/appointments/${anita!.id}`)).status()).toBe(404);
  expect(await (await elsewhere.request.get(`${origin}/api/queue`)).json()).toMatchObject({ success: true, data: [] });
  expect((await elsewhere.request.post(`${origin}/api/appointments/${anita!.id}/arrived`)).status()).toBe(404);
  await elsewhere.close();
});
