import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { addWalkIn } from "@/features/appointments/api";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { formatLongDate } from "@/lib/format/date";
import { walkInSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * The visit's records (plan §12.2; R6.2, D202 – D209), at a phone's width
 * and a desktop's. An assistant takes a waiting patient's vitals from their
 * detail (D203); the doctor sends them in and finds them on the visit, writes
 * the complaint and diagnosis, and sets a review in a week — each section
 * saved alone (D202). The assistant saves the notes meanwhile: the doctor's
 * save is refused, theirs is shown, and the doctor takes it (D206). The
 * assistant starts a visit from a profile with New visit, for the doctor,
 * and marks it done (D204). Each screen checked by axe, nothing wider than
 * the screen.
 */
test.afterAll(removeAll);

const { queue, visit: words, vitals } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const fitsTheScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });
const section = (page: Page, title: string) => page.getByRole("region", { name: title });
const waitingRow = (page: Page, name: string) =>
  page.getByRole("list", { name: queue.waiting }).getByRole("listitem").filter({ hasText: name });

/** Asha Menon's clinic, Maya Rao its doctor, an assistant, a front desk, and Rohan Mehta walked in to Maya. */
async function aClinic() {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const maya = await addMember(clinic.clinicId, {
    role: "DOCTOR",
    permissions: [
      "patients.view",
      "appointments.view",
      "appointments.edit",
      "visits.view",
      "visits.create",
      "visits.edit",
    ],
  });
  await admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId);
  const assistant = await addMember(clinic.clinicId, {
    permissions: [
      "patients.view",
      "appointments.view",
      "appointments.edit",
      "visits.view",
      "visits.create",
      "visits.edit",
    ],
  });
  const desk = await addMember(clinic.clinicId, {
    permissions: ["patients.view", "patients.create", "appointments.view", "appointments.create", "appointments.edit"],
  });
  const [{ data: doctor }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id").eq("member_id", maya.memberId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  const patientOf = async (name: string) => {
    const { data, error } = await desk
      .tenant!.supabase.rpc("create_patient", {
        p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
        p_idempotency_key: randomUUID(),
      })
      .single<{ patient_id: string }>();
    if (error) throw error;
    return data.patient_id;
  };
  const rohan = await patientOf("Rohan Mehta");
  await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: rohan }, doctorId: doctor!.id, typeId: type!.id }),
    randomUUID(),
  );
  const sunil = await patientOf("Sunil Nair");
  return { maya, assistant, sunil };
}

test("an assistant takes the vitals, the doctor writes the visit, and a visit is started from a profile", async ({
  page,
}, info) => {
  const { maya, assistant, sunil } = await aClinic();
  const phone = info.project.name === "phone";

  // The assistant takes Rohan's vitals while he waits (D203).
  await signIn(page, assistant.email, assistant.password);
  await page.goto("/queue");
  await waitingRow(page, "Rohan Mehta").getByRole("button", { name: "Rohan Mehta", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Rohan Mehta" })
    .getByRole("button", { name: words.takeVitalsOf("Rohan Mehta") })
    .click();
  const sheet = page.getByRole("dialog", { name: words.vitalsFor("Rohan Mehta") });
  await sheet.getByLabel(`${vitals.systolic} (mmHg)`).fill("120");
  await sheet.getByLabel(`${vitals.diastolic} (mmHg)`).fill("80");
  await sheet.getByLabel(`${vitals.pulse} (/min)`).fill("72");
  await sheet.getByLabel(`${vitals.temperatureF} (°F)`).fill("98.6");
  await sheet.getByLabel(`${vitals.weightKg} (kg)`).fill("64");
  await sheet.getByLabel(`${vitals.heightCm} (cm)`).fill("162");
  await expect(sheet).toContainText(`${vitals.bmi} 24.4`);
  await expectAccessible(page);
  await sheet.getByRole("button", { name: words.saveVitals }).click();
  await expect(notice(page, words.vitalsSavedFor("Rohan Mehta"))).toBeVisible();

  // The doctor sends him in and finds the vitals on his visit.
  await signIn(page, maya.email, maya.password);
  await page.goto("/queue");
  await page.getByRole("button", { name: queue.nextPatientFor("Maya Rao") }).click();
  await expect(notice(page, queue.sentIn("Rohan Mehta", "Maya Rao"))).toBeVisible();
  await (
    phone
      ? page.getByRole("link", { name: queue.openVisitOf("Rohan Mehta") })
      : page.getByRole("list", { name: queue.withDoctor }).getByRole("link", { name: "Rohan Mehta", exact: true })
  ).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rohan Mehta" })).toBeVisible();
  const vitalsCard = section(page, words.vitalsTitle);
  await expect(vitalsCard.getByLabel(`${vitals.systolic} (mmHg)`)).toHaveValue("120");
  await expect(vitalsCard).toContainText(`${vitals.bmi} 24.4`);
  await expect(vitalsCard.getByRole("button", { name: words.saveVitals })).toBeHidden();
  await expectAccessible(page);
  await fitsTheScreen(page);

  // The complaint and diagnosis, saved alone (D202).
  const notesCard = section(page, words.notesTitle);
  await notesCard.getByLabel(words.complaintLabel, { exact: true }).fill("Fever, 3 days");
  await notesCard.getByLabel(words.diagnosisLabel, { exact: true }).fill("Viral fever");
  await notesCard.getByRole("button", { name: words.saveNotes }).click();
  await expect(notice(page, words.notesSaved)).toBeVisible();
  await expect(notesCard.getByRole("button", { name: words.saveNotes })).toBeHidden();

  // A review in a week (D205).
  const followUp = section(page, words.followUpTitle);
  await followUp.getByRole("radio", { name: words.followUpChoices["1_WEEK"] }).click();
  await expect(followUp.getByRole("radio", { name: words.followUpChoices["1_WEEK"] })).toBeChecked();
  await followUp.getByRole("button", { name: words.saveFollowUp }).click();
  await expect(notice(page, words.followUpSaved(formatLongDate(addDaysKey(todayKey(), 7))))).toBeVisible();
  await expect(followUp.getByRole("button", { name: words.bookNext })).toBeHidden();
  await expectAccessible(page);

  // The assistant saves the notes while the doctor is typing them: the doctor's save is refused, theirs shown (D206).
  // The visit's own re-reads wait until the doctor has pressed Save, so theirs is news only to the save.
  const visitId = page.url().split("/").at(-1)!;
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**/api/visits/${visitId}`, async (route) => {
    if (route.request().method() === "GET") await held;
    await route.continue();
  });
  await notesCard.getByLabel(words.notesLabel, { exact: true }).fill("Paracetamol, rest");
  const { error } = await assistant.tenant!.supabase.rpc("update_visit", {
    p_visit_id: visitId,
    p_changes: { notes: "Fluids" },
    p_seen: { notes: null },
  });
  expect(error).toBeNull();
  await notesCard.getByRole("button", { name: words.saveNotes }).click();
  const refused = page.getByRole("alertdialog", { name: words.notSaved });
  await expect(refused).toContainText(ERROR_MESSAGES.VISIT_CHANGED);
  release();
  await page.unrouteAll({ behavior: "wait" });
  await refused.getByRole("button", { name: UI_TEXT.actions.close }).click();
  const theirs = notesCard.getByRole("status").filter({ hasText: words.changedMeanwhile });
  await expect(theirs).toBeVisible();
  await expect(theirs).toContainText("Fluids");
  await expect(notesCard.getByLabel(words.notesLabel, { exact: true })).toHaveValue("Paracetamol, rest");
  await expectAccessible(page);
  await theirs.getByRole("button", { name: words.useTheirs }).click();
  await expect(notesCard.getByLabel(words.notesLabel, { exact: true })).toHaveValue("Fluids");
  await expect(theirs).toBeHidden();

  // A visit from a profile (D204): the assistant chooses the doctor, then marks it done.
  await signIn(page, assistant.email, assistant.password);
  await page.goto(`/patients/${sunil}`);
  await page.getByRole("button", { name: words.newVisit }).click();
  const starting = page.getByRole("dialog", { name: words.newVisit });
  await starting.getByRole("combobox", { name: /^Doctor/ }).click();
  await page.getByRole("option", { name: "Maya Rao" }).click();
  await expectAccessible(page);
  await starting.getByRole("button", { name: words.startVisit }).click();
  await expect(notice(page, words.started("Sunil Nair"))).toBeVisible();
  await expect(page).toHaveURL(/\/visits\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sunil Nair" })).toBeVisible();
  await expectAccessible(page);
  await fitsTheScreen(page);
  await page.getByRole("button", { name: queue.doneOf("Sunil Nair") }).click();
  await expect(notice(page, words.finished("Sunil Nair"))).toBeVisible();
  await expect(page.getByRole("button", { name: queue.doneOf("Sunil Nair") })).toBeHidden();
});
