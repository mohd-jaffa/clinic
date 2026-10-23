import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { QUEUE_REFRESH_MS } from "@/constants/limits";
import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { createPatient } from "@/features/patients/api";
import { addDaysKey, dayHour, minutesOfDay, todayKey } from "@/lib/dates/calendar";
import { formatDate, formatHour, formatLongDate, formatNearDate } from "@/lib/format/date";
import { patientSchema } from "@/lib/validation";
import { expectAccessible, inviteMember, joinByInvite } from "@tests/support/e2e";
import { aMobileNumber, admin, anEmail, registerClinic, removeAll } from "@tests/support/integration";

/**
 * The clinic's day so far (plan §34.4's front desk and doctor's room).
 *
 * Phase 5 (R5.6, D177, D178): the owner invites a receptionist, a doctor and
 * an assistant, and each joins by their link. The receptionist adds a
 * patient — told who else is on the mobile — books them with the doctor for
 * later today, and a second booking into that time is refused, naming it.
 * She adds a walk-in, given #1, and marks the booked patient Arrived, given
 * #2 — while the doctor's own queue, open on their device, shows the walk-in
 * within its refresh.
 *
 * Phase 6 (R6.6, D233 – D235): she sends the walk-in in and marks him done
 * with nothing recorded — To bill. The doctor presses Next patient and the
 * booked patient goes in. The assistant takes her vitals and adds her
 * allergy, and the doctor's open visit shows both within its refresh; the
 * doctor writes the diagnosis; the assistant types the prescription, warned
 * of the allergy at its line and again at Save. The doctor prints it — the
 * clinic's A5, its name and title hers — saves it as a template of their
 * own, sets a review in a week, and Next patient, with no one waiting,
 * closes the visit. At her follow-up, Repeat fills the prescription in
 * (R6.7, D236, D240).
 *
 * The doctor cannot open a patient booked only with another doctor, and a
 * second clinic reaches none of it. At a phone's width and a desktop's, each
 * screen checked by axe.
 */
test.afterAll(removeAll);

const { patients, appointments, queue, visit, vitals, prescription, alerts } = UI_TEXT;

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
/** Long enough for a screen kept open to read again on its own: two of its refreshes. */
const REFRESHED = { timeout: QUEUE_REFRESH_MS * 2 };

test("the front desk books and arrives patients, the doctor sees them with an assistant and prints the prescription; others see only theirs", async ({
  page,
  browser,
}, info) => {
  const phone = info.project.name === "phone";
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
  // Prescriptions print on A5 here.
  await page.goto("/settings/clinic");
  await page.getByRole("radiogroup", { name: UI_TEXT.clinic.paperSize }).getByRole("radio", { name: "A5" }).click();
  await expect(notice(page, UI_TEXT.clinic.paperSizeSaved("A5"))).toBeVisible();
  await page.goto("/team");
  const receptionist = { name: "Meera Pillai", email: anEmail() };
  const doctor = { name: "Rahul Nair", email: anEmail(), doctor: true, registration: "KMC 12345" };
  const assistant = { name: "Divya Menon", email: anEmail(), preset: "Assistant / Nurse" };
  await inviteMember(page, receptionist);
  await inviteMember(page, doctor);
  await inviteMember(page, assistant);
  const desk = await joinByInvite(browser, page, receptionist.email);
  const rahul = await joinByInvite(browser, page, doctor.email);
  const nurse = await joinByInvite(browser, page, assistant.email);

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
  await expect(rahul.getByRole("list", { name: queue.waiting })).toContainText("Kiran Das", REFRESHED);

  // Anita arrives: #2.
  await desk.getByRole("button", { name: queue.markArrived("Anita Rao") }).click();
  await expect(notice(desk, queue.tokenGiven("Anita Rao", 2, "Rahul Nair"))).toBeVisible();
  const waiting = desk.getByRole("list", { name: queue.waiting });
  await expect(waiting.getByRole("listitem")).toHaveCount(2);
  await expect(waiting.getByRole("listitem").first()).toContainText("Kiran Das");
  await expectAccessible(desk);

  // She sends Kiran in and marks him done with nothing recorded: To bill (D43, D46).
  await waiting
    .getByRole("listitem")
    .filter({ hasText: "Kiran Das" })
    .getByRole("button", { name: queue.sendInOf("Kiran Das") })
    .click();
  await expect(notice(desk, queue.sentIn("Kiran Das", "Rahul Nair"))).toBeVisible();
  await (
    phone
      ? desk.getByRole("region", { name: `${queue.withDoctor}: Kiran Das` })
      : desk.getByRole("list", { name: queue.withDoctor })
  )
    .getByRole("button", { name: queue.doneOf("Kiran Das") })
    .click();
  await expect(notice(desk, queue.markedDone("Kiran Das"))).toBeVisible();
  await expectAccessible(desk);
  const { data: kiransVisit } = await admin()
    .from("visits")
    .select(
      "status, billing_status, recorded:visit_recorded, patient:patients!visits_patient_id_clinic_id_fkey!inner(full_name)",
    )
    .eq("clinic_id", clinic.clinicId)
    .eq("patient.full_name", "Kiran Das")
    .single();
  expect(kiransVisit).toMatchObject({ status: "COMPLETED", billing_status: "TO_BILL", recorded: false });
  // He waits in the queue's To bill, with Bill (D318).
  await expect(
    desk
      .getByRole("list", { name: queue.toBill })
      .getByRole("listitem")
      .filter({ hasText: "Kiran Das" })
      .getByRole("button", { name: UI_TEXT.billing.checkOut("Kiran Das") }),
  ).toBeVisible();

  // The doctor presses Next patient: Anita, #2, goes in, and the doctor opens her visit.
  await rahul.goto("/queue");
  await rahul.getByRole("button", { name: queue.nextPatientFor("Rahul Nair") }).click();
  await expect(notice(rahul, queue.sentIn("Anita Rao", "Rahul Nair"))).toBeVisible();
  await (
    phone
      ? rahul.getByRole("link", { name: queue.openVisitOf("Anita Rao") })
      : rahul.getByRole("list", { name: queue.withDoctor }).getByRole("link", { name: "Anita Rao", exact: true })
  ).click();
  await expect(rahul.getByRole("heading", { level: 1, name: "Anita Rao" })).toBeVisible();
  const anitasVisit = new URL(rahul.url()).pathname.split("/").at(-1)!;
  await expectAccessible(rahul);

  // The assistant, on her own device, takes Anita's vitals and adds her allergy.
  await nurse.goto(`/visits/${anitasVisit}`);
  const readings = nurse.getByRole("region", { name: visit.vitalsTitle });
  await readings.getByLabel(`${vitals.systolic} (mmHg)`).fill("120");
  await readings.getByLabel(`${vitals.diastolic} (mmHg)`).fill("80");
  await readings.getByLabel(`${vitals.pulse} (/min)`).fill("72");
  await readings.getByRole("button", { name: visit.saveVitals }).click();
  await expect(notice(nurse, visit.vitalsSaved)).toBeVisible();
  await nurse.getByRole("button", { name: alerts.open, exact: true }).click();
  const alertsSheet = nurse.getByRole("dialog", { name: alerts.title });
  await alertsSheet.getByRole("button", { name: alerts.add }).click();
  const allergy = nurse.getByRole("dialog", { name: alerts.addTitle });
  await allergy.getByRole("radio", { name: "Allergy" }).click();
  await allergy.getByRole("textbox", { name: /^Name/ }).fill("Penicillin");
  await allergy.getByRole("button", { name: alerts.add }).click();
  await expect(notice(nurse, alerts.added("Penicillin"))).toBeVisible();
  await alertsSheet.getByRole("button", { name: UI_TEXT.actions.close, exact: true }).click();
  await expectAccessible(nurse);

  // The doctor's open visit shows both within its refresh, without a reload (D234).
  const seen = rahul.getByRole("region", { name: visit.vitalsTitle });
  await expect(seen.getByLabel(`${vitals.systolic} (mmHg)`)).toHaveValue("120", REFRESHED);
  await expect(seen.getByLabel(`${vitals.pulse} (/min)`)).toHaveValue("72");
  await expect(rahul.getByRole("list", { name: alerts.title }).first()).toContainText("Penicillin");

  // The doctor writes the diagnosis.
  const notes = rahul.getByRole("region", { name: visit.notesTitle });
  await notes.getByLabel(visit.diagnosisLabel, { exact: true }).fill("Dental caries");
  await notes.getByRole("button", { name: visit.saveNotes }).click();
  await expect(notice(rahul, visit.notesSaved)).toBeVisible();

  // The assistant types the prescription; the medicine naming her allergy is warned, at its line and at Save (D212).
  const card = nurse.getByRole("region", { name: prescription.title });
  await expect(card.getByRole("list", { name: alerts.title })).toContainText("Penicillin");
  await card.getByRole("button", { name: prescription.addMedicine }).click();
  const paracetamol = card.getByRole("group", { name: prescription.medicineN(1) });
  await paracetamol.getByRole("combobox", { name: prescription.medicineLabel }).fill("Paracetamol");
  await paracetamol.getByLabel(prescription.strengthLabel).fill("500 mg");
  await paracetamol.getByLabel(prescription.doseLabel).fill("1 tab");
  await paracetamol.getByRole("radio", { name: "1-0-1" }).click();
  await paracetamol.getByLabel(prescription.daysLabel).fill("5");
  await card.getByRole("button", { name: prescription.addMedicine }).click();
  const penicillin = card.getByRole("group", { name: prescription.medicineN(2) });
  await penicillin.getByRole("combobox", { name: prescription.medicineLabel }).fill("Penicillin V");
  await expect(penicillin).toContainText(prescription.allergy("Penicillin"));
  await card.getByRole("button", { name: prescription.save }).click();
  const asked = nurse.getByRole("alertdialog", { name: prescription.allergyConfirmTitle });
  await expect(asked).toContainText(prescription.allergyLine("Penicillin V", "Penicillin"));
  await expectAccessible(nurse);
  // She goes back, takes it off, and saves the rest.
  await asked.getByRole("button", { name: UI_TEXT.actions.cancel }).click();
  await penicillin.getByRole("button", { name: prescription.remove(2) }).click();
  await card.getByRole("button", { name: prescription.save }).click();
  await expect(notice(nurse, prescription.saved)).toBeVisible();
  await expect(card).toContainText(prescription.typedBy("Divya Menon"));

  // The doctor prints it: the clinic's A5, named and titled for Anita (D235).
  const today = formatDate(todayKey());
  const rx = rahul.getByRole("region", { name: prescription.title });
  const print = rx.getByRole("link", { name: prescription.printOf("Anita Rao") });
  await expect(print).toBeVisible(REFRESHED);
  const opened = await rahul.request.get((await print.getAttribute("href"))!);
  expect(opened.headers()["content-type"]).toBe("application/pdf");
  expect(opened.headers()["content-disposition"]).toContain(`filename="Anita Rao - ${today} - Prescription.pdf"`);
  const pdf = (await opened.body()).toString("latin1");
  expect(pdf).toContain("/MediaBox [0 0 419.53 595.28]");
  expect(pdf).toContain(`(${UI_TEXT.documents.prescriptionTitle("Anita Rao", today)})`);
  const [tab] = await Promise.all([rahul.waitForEvent("popup"), print.click()]);
  await tab.close();
  const [download] = await Promise.all([
    rahul.waitForEvent("download"),
    rx.getByRole("button", { name: prescription.downloadOf("Anita Rao") }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`Anita Rao - ${today} - Prescription.pdf`);
  expect((await readFile((await download.path())!)).toString("latin1")).toContain("/MediaBox [0 0 419.53 595.28]");
  await expectAccessible(rahul);

  // The doctor saves it as a template of their own (D240).
  await rx.getByRole("button", { name: prescription.saveAsTemplate }).click();
  const naming = rahul.getByRole("dialog", { name: prescription.saveAsTemplate });
  await naming.getByRole("textbox", { name: new RegExp(`^${prescription.templateNameLabel}`) }).fill("Dental pain");
  await expectAccessible(rahul);
  await naming.getByRole("button", { name: prescription.saveAsTemplate }).click();
  await expect(notice(rahul, prescription.templateSaved("Dental pain"))).toBeVisible();

  // A review in a week, then Next patient: no one is waiting, so the visit closes and the queue opens (D194).
  const followUp = rahul.getByRole("region", { name: visit.followUpTitle });
  await followUp.getByRole("radio", { name: visit.followUpChoices["1_WEEK"] }).click();
  await followUp.getByRole("button", { name: visit.saveFollowUp }).click();
  await expect(notice(rahul, visit.followUpSaved(formatLongDate(addDaysKey(todayKey(), 7))))).toBeVisible();
  await rahul
    .getByRole("button", { name: queue.nextPatientAfter("Anita Rao") })
    .first()
    .click();
  await expect(notice(rahul, queue.noOneWaiting)).toBeVisible();
  await expect(rahul).toHaveURL(/\/queue$/);
  const { data: closed } = await admin()
    .from("visits")
    .select("status, billing_status, diagnosis, follow_up_on")
    .eq("id", anitasVisit)
    .single();
  expect(closed).toEqual({
    status: "COMPLETED",
    billing_status: "TO_BILL",
    diagnosis: "Dental caries",
    follow_up_on: addDaysKey(todayKey(), 7),
  });
  await expectAccessible(rahul);

  // The doctor cannot open a patient booked only with another doctor.
  await rahul.goto("/patients");
  await rahul.getByRole("searchbox", { name: patients.searchPlaceholder }).fill("Sunil");
  await expect(rahul.getByText(patients.noMatches("Sunil"))).toBeVisible();
  await rahul.goto(`/patients/${sunil.id}`);
  await expect(rahul.getByText(ERROR_MESSAGES.RECORD_NOT_FOUND)).toBeVisible();
  await expectAccessible(rahul);

  // At her follow-up, Repeat fills in the prescription before (D236): its day and doctor named.
  const { data: her } = await admin().from("visits").select("patient_id").eq("id", anitasVisit).single();
  await rahul.goto(`/patients/${her!.patient_id}`);
  await rahul.getByRole("button", { name: visit.newVisit }).click();
  await expect(rahul).toHaveURL(/\/visits\/[0-9a-f-]{36}\?from=patient$/);
  const followUpRx = rahul.getByRole("region", { name: prescription.title });
  await followUpRx
    .getByRole("button", {
      name: prescription.repeat(formatNearDate(todayKey()), UI_TEXT.documents.doctor("Rahul Nair")),
    })
    .click();
  const repeated = followUpRx.getByRole("group", { name: prescription.medicineN(1) });
  await expect(repeated.getByRole("combobox", { name: prescription.medicineLabel })).toHaveValue("Paracetamol");
  await expect(repeated.getByLabel(prescription.daysLabel)).toHaveValue("5");
  await expect(followUpRx.getByRole("group", { name: prescription.medicineN(2) })).toHaveCount(0);
  await followUpRx.getByRole("button", { name: prescription.save }).click();
  await expect(notice(rahul, prescription.saved)).toBeVisible();
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
    .eq("status", "COMPLETED")
    .single();
  const origin = new URL(page.url()).origin;
  expect((await elsewhere.request.get(`${origin}/api/appointments/${anita!.id}`)).status()).toBe(404);
  expect(await (await elsewhere.request.get(`${origin}/api/queue`)).json()).toMatchObject({ success: true, data: [] });
  expect((await elsewhere.request.post(`${origin}/api/appointments/${anita!.id}/arrived`)).status()).toBe(404);
  expect((await elsewhere.request.get(`${origin}/api/visits/${anitasVisit}`)).status()).toBe(404);
  expect((await elsewhere.request.get(`${origin}/api/visits/${anitasVisit}/prescription.pdf`)).status()).toBe(404);
  await elsewhere.close();
});
