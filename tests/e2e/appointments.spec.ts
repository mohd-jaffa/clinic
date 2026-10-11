import { randomUUID } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
import { formatDayMonth, formatLongDate } from "@/lib/format/date";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll, type TestClinic } from "@tests/support/integration";

/**
 * Booking (plan §11.1; R5.2, D144 – D151): the front desk opens the booking
 * sheet from the ＋, finds a patient, sees what the doctor already has that
 * day, is told the time is taken — naming it — and books the next free one.
 * A patient new to the clinic is added with their booking. At a phone's
 * width and a desktop's, each checked by axe.
 */
test.afterAll(removeAll);

const { appointments, actions } = UI_TEXT;
const tomorrow = addDaysKey(todayKey(), 1);

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

/** A clinic whose owner sees patients, a receptionist, and Rohan Mehta booked with the owner tomorrow at 10, 11 and 4. */
async function clinicWithABooking(): Promise<{ clinic: TestClinic; desk: { email: string; password: string } }> {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const desk = await addMember(clinic.clinicId, {
    permissions: ["patients.view", "patients.create", "appointments.view", "appointments.create"],
  });
  const { supabase } = clinic.owner.tenant;
  const { data: patient } = await supabase
    .rpc("create_patient", {
      p_patient: { full_name: "Rohan Mehta", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  const [{ data: doctor }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id").eq("clinic_id", clinic.clinicId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  // Three times that day: enough to wrap on a phone, so a line that cannot break would show.
  for (const hour of [10, 11, 16]) {
    const { error } = await supabase.rpc("create_appointment", {
      p_appointment: {
        patient_id: patient!.patient_id,
        doctor_id: doctor!.id,
        appointment_type_id: type!.id,
        scheduled_at: dayHour(tomorrow, hour),
        duration_minutes: 15,
      },
      p_idempotency_key: randomUUID(),
    });
    expect(error).toBeNull();
  }
  return { clinic, desk };
}

/** Picks a day in a date field, turning to next month when it is not this one's. */
async function pickDay(page: Page, sheet: Locator, field: RegExp, key: string) {
  await sheet.getByRole("button", { name: field }).click();
  const day = page.getByRole("button", { name: formatLongDate(key) });
  if (!(await day.isVisible())) await page.getByRole("button", { name: UI_TEXT.datePicker.nextMonth }).click();
  await day.click();
}

async function pickTime(page: Page, sheet: Locator, hour: string, minute: string) {
  await sheet.getByRole("combobox", { name: `${appointments.timeLabel}, ${appointments.hourLabel}` }).click();
  await page.getByRole("option", { name: hour, exact: true }).click();
  await sheet.getByRole("combobox", { name: `${appointments.timeLabel}, ${appointments.minuteLabel}` }).click();
  await page.getByRole("option", { name: minute, exact: true }).click();
}

const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });

test("the front desk books from the ＋, sees the doctor's day, and books past a taken time", async ({ page }) => {
  const { desk } = await clinicWithABooking();
  await signIn(page, desk.email, desk.password);

  await page.goto("/home");
  await page.getByRole("button", { name: UI_TEXT.quickActions.title }).click();
  await page
    .getByRole("dialog", { name: UI_TEXT.quickActions.title })
    .getByRole("link", { name: UI_TEXT.quickActions.appointment })
    .click();
  await expect(page).toHaveURL(/\/appointments\?add=appointment$/);
  const sheet = page.getByRole("dialog", { name: appointments.bookTitle });

  // The patient, found by a part of their name (D144).
  await sheet.getByRole("searchbox", { name: appointments.searchPatients }).fill("roh");
  await sheet.getByRole("button", { name: "Rohan Mehta" }).click();
  await expect(sheet.getByRole("button", { name: appointments.changeNamed("Rohan Mehta") })).toBeVisible();

  // The clinic's only doctor and its first type are already chosen (D149); the doctor's day shows (D147).
  await expect(sheet.getByRole("combobox", { name: /^Doctor/ })).toHaveText("Asha Menon");
  await pickDay(page, sheet, /^Date/, tomorrow);
  await expect(
    sheet.getByText(
      `${appointments.doctorDayLead("Asha Menon")} 10:00 AM – 10:15 AM, 11:00 AM – 11:15 AM, 4:00 PM – 4:15 PM.`,
    ),
  ).toBeVisible();
  await pickTime(page, sheet, "10 AM", ":00");
  // Nothing in the sheet runs off the screen's side, the doctor's day included.
  const change = await sheet.getByRole("button", { name: appointments.changeNamed("Rohan Mehta") }).boundingBox();
  expect(change!.x + change!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expectAccessible(page);

  // Taken: the card names the clash, and the sheet keeps everything (D148).
  await sheet.getByRole("button", { name: appointments.book }).click();
  const clash = page.getByRole("alertdialog", { name: appointments.slotTaken("Asha Menon", "10:00 AM – 10:15 AM") });
  await expect(clash).toBeVisible();
  await expectAccessible(page);
  await clash.getByRole("button", { name: actions.close }).click();
  await expect(sheet.getByRole("button", { name: appointments.changeNamed("Rohan Mehta") })).toBeVisible();

  await sheet.getByRole("combobox", { name: `${appointments.timeLabel}, ${appointments.minuteLabel}` }).click();
  await page.getByRole("option", { name: ":30", exact: true }).click();
  await sheet.getByRole("button", { name: appointments.book }).click();
  await expect(sheet).toBeHidden();
  await expect(
    notice(
      page,
      appointments.booked("Rohan Mehta", appointments.bookedWhen(formatDayMonth(tomorrow), "10:30 AM"), "Asha Menon"),
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/appointments$/);
});

test("a patient new to the clinic is added with their booking", async ({ page }) => {
  const { clinic, desk } = await clinicWithABooking();
  await signIn(page, desk.email, desk.password);

  await page.goto("/appointments");
  await page.getByRole("button", { name: appointments.book }).first().click();
  const sheet = page.getByRole("dialog", { name: appointments.bookTitle });
  await sheet.getByRole("searchbox", { name: appointments.searchPatients }).fill("Meera Pillai");
  await expect(sheet.getByText(appointments.noMatches)).toBeVisible();
  await sheet.getByRole("button", { name: appointments.newPatient }).click();

  // What was typed fills the name (D112); "Already here?" names the family on the mobile.
  const added = sheet.getByRole("region", { name: appointments.newPatient });
  await expect(added.getByRole("textbox", { name: /^Full name/ })).toHaveValue("Meera Pillai");
  await added.getByRole("textbox", { name: /^Mobile/ }).fill("98765 43210");
  await expect(added.getByText(/Already here\? 1 patient has this mobile/)).toBeVisible();
  await added.getByRole("radio", { name: UI_TEXT.patients.bornAs.AGE }).click();
  await added.getByRole("textbox", { name: /^Age in years/ }).fill("34");
  await added.getByRole("radio", { name: "Female" }).click();
  await pickDay(page, sheet, /^Date/, tomorrow);
  await pickTime(page, sheet, "11 AM", ":15");
  await sheet.getByRole("radio", { name: appointments.minutes(30) }).click();
  await expectAccessible(page);

  await sheet.getByRole("button", { name: appointments.book }).click();
  await expect(
    notice(
      page,
      appointments.booked("Meera Pillai", appointments.bookedWhen(formatDayMonth(tomorrow), "11:15 AM"), "Asha Menon"),
    ),
  ).toBeVisible();
  const { data } = await admin()
    .from("patients")
    .select("id, appointments(duration_minutes)")
    .eq("clinic_id", clinic.clinicId)
    .eq("full_name", "Meera Pillai");
  expect(data).toEqual([{ id: expect.any(String), appointments: [{ duration_minutes: 30 }] }]);
});
