import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
import { formatDayMonth, formatLongDate } from "@/lib/format/date";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * An appointment's detail (plan §11.2; R5.4, D160 – D167). On a phone: open
 * tomorrow's from the day's list, confirm it, then cancel it with a reason,
 * asked first, to find it folded away. On a desktop: open one from the grid
 * and reschedule it an hour later; then the patient's profile — the next
 * appointment, the history, a detail opened there — and Book for a patient
 * with nothing to come. Each checked by axe, and nothing wider than the screen.
 */
test.afterAll(removeAll);

const { appointment: words, calendar, patients, appointments } = UI_TEXT;
const tomorrow = addDaysKey(todayKey(), 1);

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

/** Asha Menon's clinic, Maya Rao its doctor, a front desk, and Rohan Mehta booked for 10 tomorrow. */
async function aBookedClinic() {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const maya = await addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view"] });
  await admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId);
  const desk = await addMember(clinic.clinicId, {
    permissions: [
      "patients.view",
      "patients.create",
      "appointments.view",
      "appointments.create",
      "appointments.edit",
      "appointments.cancel",
    ],
  });
  const { supabase } = desk.tenant!;
  const patient = async (name: string) =>
    (
      await supabase
        .rpc("create_patient", {
          p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
          p_idempotency_key: randomUUID(),
        })
        .single<{ patient_id: string }>()
    ).data!.patient_id;
  const [{ data: doctor }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id").eq("member_id", maya.memberId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  const [rohan, sunil] = await Promise.all([patient("Rohan Mehta"), patient("Sunil Nair")]);
  await supabase.rpc("create_appointment", {
    p_appointment: {
      patient_id: rohan,
      doctor_id: doctor!.id,
      appointment_type_id: type!.id,
      scheduled_at: dayHour(tomorrow, 10),
      duration_minutes: 15,
      notes: "Bring the X-ray",
    },
    p_idempotency_key: randomUUID(),
  });
  return { desk, rohan, sunil };
}

const fitsTheScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );

test("on a phone: an appointment opened, confirmed, then cancelled with a reason", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the day as a list is the phone's calendar");
  const { desk } = await aBookedClinic();
  await signIn(page, desk.email, desk.password);

  await page.goto("/appointments");
  await page
    .getByRole("radiogroup", { name: calendar.day })
    .getByRole("radio", { name: formatLongDate(tomorrow) })
    .click();
  const day = page.getByRole("list", { name: calendar.dayGrid(formatLongDate(tomorrow)) });
  await day.getByRole("button", { name: "Rohan Mehta" }).click();
  const detail = page.getByRole("dialog", { name: "Rohan Mehta" });
  await expect(detail).toContainText("Bring the X-ray");
  await expect(detail).toContainText(words.bookedLabel);
  await expectAccessible(page);

  await detail.getByRole("button", { name: words.confirm }).click();
  await expect(detail).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Confirmed Rohan Mehta" })).toBeVisible();
  await expect(day.getByRole("listitem")).toContainText("Confirmed");

  await day.getByRole("button", { name: "Rohan Mehta" }).click();
  await detail.getByRole("button", { name: words.cancel }).click();
  const cancel = page.getByRole("dialog", { name: words.cancelTitle });
  await cancel.getByRole("radio", { name: words.reasons[0] }).click();
  await fitsTheScreen(page);
  await expectAccessible(page);
  await cancel.getByRole("button", { name: words.cancel }).click();
  const ask = page.getByRole("alertdialog", { name: words.cancelAsk("Rohan Mehta") });
  await expect(ask).toContainText(`Reason: ${words.reasons[0]}.`);
  await ask.getByRole("button", { name: words.cancel }).click();
  await expect(cancel).toBeHidden();
  const cancelled = words.cancelled("Rohan Mehta", appointments.bookedWhen(formatDayMonth(tomorrow), "10:00 AM"));
  await expect(page.getByRole("status").filter({ hasText: cancelled })).toBeVisible();
  // The card lies over the foot of the day: closed, it uncovers it.
  await page.getByRole("button", { name: UI_TEXT.response.closeNotice(cancelled) }).click();

  await page.getByRole("button", { name: calendar.cancelled(1) }).click();
  await page
    .getByRole("list", { name: calendar.cancelled(1) })
    .getByRole("button", { name: "Rohan Mehta" })
    .click();
  await expect(detail).toContainText(words.reasons[0]);
  await expect(detail.getByRole("group", { name: words.actions })).toBeVisible();
  await expect(detail.getByRole("button", { name: words.editNotes })).toBeVisible();
});

test("on a desktop: rescheduled from the grid, then the patient's next appointment, history and Book", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the grid is the wider screens' calendar");
  const { desk, rohan, sunil } = await aBookedClinic();
  await signIn(page, desk.email, desk.password);

  await page.goto("/appointments");
  await page.getByRole("button", { name: calendar.nextDay }).click();
  const grid = page.getByRole("region", { name: calendar.dayGrid(formatLongDate(tomorrow)) });
  await grid.getByRole("button", { name: /Rohan Mehta/ }).click();
  const detail = page.getByRole("dialog", { name: "Rohan Mehta" });
  await detail.getByRole("button", { name: words.reschedule }).click();
  const move = page.getByRole("dialog", { name: words.rescheduleTitle });
  await expect(move.getByRole("list", { name: appointments.patientLabel })).toContainText("Rohan Mehta");
  await expectAccessible(page);
  await move.getByRole("combobox", { name: `${appointments.timeLabel}, ${appointments.hourLabel}` }).click();
  await page.getByRole("option", { name: "11 AM" }).click();
  await move.getByRole("button", { name: UI_TEXT.actions.save }).click();
  await expect(move).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Moved Rohan Mehta" })).toBeVisible();
  await expect(grid.getByRole("list", { name: "Maya Rao" })).toContainText("11:00 AM – 11:15 AM, Rohan Mehta");

  await page.goto(`/patients/${rohan}`);
  const next = page.getByRole("region", { name: patients.nextAppointment });
  await expect(next).toContainText(formatLongDate(tomorrow));
  await expect(next).toContainText("11:00 AM · Maya Rao · Consultation");
  const history = page.getByRole("region", { name: patients.history });
  await expect(history.getByRole("listitem")).toHaveCount(1);
  await fitsTheScreen(page);
  await expectAccessible(page);
  await history.getByRole("listitem").getByRole("button").click();
  await expect(detail).toBeVisible();
  await expect(detail.getByRole("link", { name: words.openProfileOf("Rohan Mehta") })).toHaveCount(0);
  await detail.getByRole("button", { name: UI_TEXT.actions.close }).click();

  await page.goto(`/patients/${sunil}`);
  const none = page.getByRole("region", { name: patients.nextAppointment });
  await expect(none).toContainText(patients.noNextAppointment);
  await none.getByRole("button", { name: patients.bookFor("Sunil Nair") }).click();
  const book = page.getByRole("dialog", { name: appointments.bookTitle });
  await expect(book.getByRole("list", { name: appointments.patientLabel })).toContainText("Sunil Nair");
  await book.getByRole("combobox", { name: /^Doctor/ }).click();
  await page.getByRole("option", { name: "Maya Rao" }).click();
  await book.getByRole("button", { name: /^Date/ }).click();
  // Tomorrow may be next month's first day.
  const day = page.getByRole("button", { name: formatLongDate(tomorrow) });
  if (!(await day.isVisible())) await page.getByRole("button", { name: UI_TEXT.datePicker.nextMonth }).click();
  await day.click();
  await book.getByRole("combobox", { name: `${appointments.timeLabel}, ${appointments.hourLabel}` }).click();
  await page.getByRole("option", { name: "3 PM" }).click();
  await book.getByRole("combobox", { name: `${appointments.timeLabel}, ${appointments.minuteLabel}` }).click();
  await page.getByRole("option", { name: ":00" }).click();
  await book.getByRole("button", { name: appointments.book }).click();
  await expect(book).toBeHidden();
  await expect(none).toContainText("3:00 PM · Maya Rao · Consultation");
  await expect(page.getByRole("region", { name: patients.history }).getByRole("listitem")).toHaveCount(1);
});
