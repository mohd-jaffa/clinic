import { expect, test, type Page } from "@playwright/test";

import { randomUUID } from "node:crypto";

import { UI_TEXT } from "@/constants/messages";
import { dayHour, todayKey } from "@/lib/dates/calendar";
import { formatDayMonth, formatLongDate } from "@/lib/format/date";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll, type TestClinic } from "@tests/support/integration";

/**
 * Holidays and leave (plan §9; R3.3, D84 – D86): the owner closes the clinic
 * for a day, is refused a second closure of the clinic on it, takes their own
 * leave the same day — a doctor's leave may sit inside a holiday — and removes
 * the holiday, asked first. Days that already have appointments list them
 * as they are picked, and saving leaves them booked (D137). A member without
 * settings.manage is told the screen is not theirs. At a phone's width and a
 * desktop's, each checked by axe.
 */
test.afterAll(removeAll);

const { actions, closures, settings } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });

async function addToday(page: Page, who: string, reason: string) {
  await page.getByRole("button", { name: closures.add }).click();
  const sheet = page.getByRole("dialog", { name: closures.addTitle });
  if (who !== closures.wholeClinic) {
    await sheet.getByRole("combobox", { name: /^Who’s away/ }).click();
    await page.getByRole("option", { name: who }).click();
  }
  await sheet.getByRole("button", { name: /^First day/ }).click();
  await page.getByRole("button", { name: formatLongDate(todayKey()) }).click();
  await sheet.getByRole("textbox", { name: /^Reason/ }).fill(reason);
  await expectAccessible(page);
  await sheet.getByRole("button", { name: actions.save }).click();
  return sheet;
}

test("the owner closes the clinic for a day, takes leave, and removes the holiday", async ({ page }) => {
  const { owner } = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  await signIn(page, owner.email, owner.password);

  await page.goto("/settings");
  await page.getByRole("link", { name: settings.items.closures.label }).click();
  await expect(page).toHaveURL(/\/settings\/closures$/);
  await expect(page.getByRole("heading", { name: closures.emptyTitle })).toBeVisible();
  await expectAccessible(page);

  // The whole clinic, today: the last day follows the first.
  const sheet = await addToday(page, closures.wholeClinic, "Founders’ day");
  await expect(sheet).toBeHidden();
  await expect(notice(page, closures.added("Founders’ day"))).toBeVisible();
  const coming = page.getByRole("list", { name: closures.upcoming });
  await expect(coming).toContainText("Founders’ dayWhole clinic");
  await expect(coming).toContainText("1 day");
  await expect(page.getByText(closures.count(1))).toBeVisible();

  // Not twice for the same people (D86).
  const again = await addToday(page, closures.wholeClinic, "Holiday");
  await expect(page.getByRole("alertdialog", { name: closures.notSaved })).toContainText("Those days overlap");
  await page.getByRole("alertdialog", { name: closures.notSaved }).getByRole("button", { name: actions.close }).click();
  await again.getByRole("button", { name: actions.close }).click();

  // But the owner's own leave sits inside the holiday.
  await addToday(page, "Asha Menon", "Conference");
  await expect(notice(page, closures.added("Conference"))).toBeVisible();
  await expect(coming).toContainText("ConferenceAsha Menon");

  // Removed, asked first (D84).
  await page.getByRole("button", { name: closures.removeNamed("Founders’ day") }).click();
  const ask = page.getByRole("alertdialog", { name: closures.removeTitle("Founders’ day") });
  await expectAccessible(page);
  await ask.getByRole("button", { name: closures.remove }).click();
  await expect(notice(page, closures.removed("Founders’ day"))).toBeVisible();
  await expect(coming).not.toContainText("Founders’ day");
  await expect(page.getByText(closures.count(1))).toBeVisible();
});

/** A patient booked with the owner today at noon, as the booking sheet (R5.2) will book one. */
async function bookToday({ clinicId, owner }: TestClinic, name: string): Promise<string> {
  const { data: patient, error } = await owner.tenant.supabase
    .rpc("create_patient", {
      p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  const [{ data: doctor }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id").eq("clinic_id", clinicId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinicId).eq("name", "Consultation").single(),
  ]);
  // Written straight in: noon may already have passed today, and booking refuses the past.
  const { data: appointment, error: refused } = await admin()
    .from("appointments")
    .insert({
      clinic_id: clinicId,
      patient_id: patient.patient_id,
      doctor_id: doctor!.id,
      source: "BOOKED",
      appointment_type_id: type!.id,
      scheduled_at: dayHour(todayKey(), 12),
      duration_minutes: 15,
    })
    .select("id")
    .single();
  if (refused) throw refused;
  return appointment.id as string;
}

test("days that already have appointments list them as they are picked, and keep them booked", async ({ page }) => {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const manager = await addMember(clinic.clinicId, { permissions: ["settings.manage"] });
  const appointmentId = await bookToday(clinic, "Rahul Verma");
  const when = closures.appointmentWhen(formatDayMonth(todayKey()), "12:00 PM", "Asha Menon");
  await signIn(page, clinic.owner.email, clinic.owner.password);

  await page.goto("/settings/closures");
  await page.getByRole("button", { name: closures.add }).click();
  const sheet = page.getByRole("dialog", { name: closures.addTitle });
  await sheet.getByRole("button", { name: /^First day/ }).click();
  await page.getByRole("button", { name: formatLongDate(todayKey()) }).click();
  const listed = sheet.getByRole("region", { name: closures.appointmentsOnDays(1) });
  await expect(listed).toContainText(closures.appointmentsStay);
  await expect(listed).toContainText("Rahul Verma");
  await expect(listed).toContainText(when);
  await expectAccessible(page);

  await sheet.getByRole("textbox", { name: /^Reason/ }).fill("Founders’ day");
  await sheet.getByRole("button", { name: actions.save }).click();
  await expect(notice(page, closures.added("Founders’ day"))).toBeVisible();
  const { data: kept } = await admin().from("appointments").select("status").eq("id", appointmentId).single();
  expect(kept!.status).toBe("SCHEDULED");

  // Someone who may not see patients is told of the appointment, not whose it is.
  await signIn(page, manager.email, manager.password);
  await page.goto("/settings/closures");
  await page.getByRole("button", { name: closures.add }).click();
  await sheet.getByRole("combobox", { name: /^Who’s away/ }).click();
  await page.getByRole("option", { name: "Asha Menon" }).click();
  await sheet.getByRole("button", { name: /^First day/ }).click();
  await page.getByRole("button", { name: formatLongDate(todayKey()) }).click();
  await expect(listed).toContainText(closures.aPatient);
  await expect(listed).toContainText(when);
  await expect(listed).not.toContainText("Rahul Verma");
  await expectAccessible(page);
});

test("a member without settings.manage is told the screen is not theirs", async ({ page }) => {
  const { clinicId } = await registerClinic();
  const member = await addMember(clinicId, { permissions: ["patients.view"] });
  await signIn(page, member.email, member.password);

  await page.goto("/settings/closures");
  await expect(page.getByRole("heading", { level: 1, name: UI_TEXT.system.noAccessTitle })).toBeVisible();
  await expectAccessible(page);
});
