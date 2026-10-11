import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
import { formatDayMonth, formatLongDate } from "@/lib/format/date";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * The calendar (plan §11.5; R5.3, D152 – D159). On a phone: today's list,
 * a walk-in at the time they arrived; another day from the strip; the
 * cancelled folded away and counted. On a desktop: a column per doctor, a
 * tapped empty quarter booking there with its doctor, day and time, and a
 * doctor's week. Each checked by axe, and nothing wider than the screen.
 */
test.afterAll(removeAll);

const { calendar, appointments } = UI_TEXT;
const tomorrow = addDaysKey(todayKey(), 1);

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

/** Asha Menon's clinic with Maya Rao, a receptionist, and tomorrow's book — and a walk-in today. */
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
  const [{ data: doctorRows }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id, member_id").eq("clinic_id", clinic.clinicId),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  const mayaId = doctorRows!.find((row) => row.member_id === maya.memberId)!.id as string;
  const ashaId = doctorRows!.find((row) => row.member_id !== maya.memberId)!.id as string;
  const book = async (patientId: string, doctorId: string, hour: number) =>
    (
      await supabase
        .rpc("create_appointment", {
          p_appointment: {
            patient_id: patientId,
            doctor_id: doctorId,
            appointment_type_id: type!.id,
            scheduled_at: dayHour(tomorrow, hour),
            duration_minutes: 15,
          },
          p_idempotency_key: randomUUID(),
        })
        .single<{ appointment_id: string }>()
    ).data!.appointment_id;
  const [rohan, anita, kiran, sunil] = await Promise.all([
    patient("Rohan Mehta"),
    patient("Anita Rao"),
    patient("Kiran Das"),
    patient("Sunil Nair"),
  ]);
  await book(rohan, mayaId, 9);
  await book(anita, ashaId, 10);
  const cancelled = await book(kiran, mayaId, 11);
  await supabase.rpc("change_appointment_status", {
    p_appointment_id: cancelled,
    p_status: "CANCELLED",
    p_reason: "Travelling",
  });
  await supabase.rpc("add_walk_in", {
    p_walk_in: { patient_id: sunil, doctor_id: mayaId, appointment_type_id: type!.id },
    p_idempotency_key: randomUUID(),
  });
  return { desk };
}

const fitsTheScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );

test("on a phone: today's list, another day from the strip, the cancelled folded away", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the day as a list is the phone's calendar");
  const { desk } = await aBookedClinic();
  await signIn(page, desk.email, desk.password);

  await page.goto("/appointments");
  const today = page.getByRole("list", { name: calendar.dayGrid(formatLongDate(todayKey())) });
  await expect(today.getByRole("listitem")).toHaveCount(1);
  await expect(today).toContainText("Sunil Nair");
  await expect(today).toContainText(`${calendar.walkIn} ${calendar.token(1)} · Maya Rao`);
  await fitsTheScreen(page);
  await expectAccessible(page);

  await page
    .getByRole("radiogroup", { name: calendar.day })
    .getByRole("radio", { name: formatLongDate(tomorrow) })
    .click();
  const day = page.getByRole("list", { name: calendar.dayGrid(formatLongDate(tomorrow)) });
  await expect(day.getByRole("listitem")).toHaveCount(2);
  await expect(day.getByRole("listitem").first()).toContainText("Rohan Mehta");
  await expect(day.getByRole("listitem").first()).toContainText("9:00 AM · Consultation · Maya Rao");
  await expect(day.getByRole("listitem").nth(1)).toContainText("Anita Rao");

  await page.getByRole("button", { name: calendar.cancelled(1) }).click();
  await expect(page.getByRole("list", { name: calendar.cancelled(1) })).toContainText("Kiran Das");
  await fitsTheScreen(page);
  await expectAccessible(page);
});

test("on a desktop: a column per doctor, a tapped quarter booked there, and a doctor's week", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the grid is the wider screens' calendar");
  const { desk } = await aBookedClinic();
  await signIn(page, desk.email, desk.password);

  await page.goto("/appointments");
  await page.getByRole("button", { name: calendar.nextDay }).click();
  const grid = page.getByRole("region", { name: calendar.dayGrid(formatLongDate(tomorrow)) });
  await expect(grid.getByRole("list", { name: "Maya Rao" })).toContainText(
    "9:00 AM – 9:15 AM, Rohan Mehta, Consultation, Scheduled",
  );
  await expect(grid.getByRole("list", { name: "Asha Menon" })).toContainText("Anita Rao");
  await expect(grid.getByRole("list", { name: "Maya Rao" })).not.toContainText("Kiran Das");
  await fitsTheScreen(page);
  await expectAccessible(page);

  // 2 PM in Maya Rao's column: the 24th quarter from 8 AM (D156).
  const steps = grid.getByRole("list", { name: "Maya Rao" }).locator("xpath=..").locator("[aria-hidden='true'] > div");
  await steps.nth(24).click();
  const sheet = page.getByRole("dialog", { name: appointments.bookTitle });
  await expect(sheet.getByRole("combobox", { name: /^Doctor/ })).toHaveText("Maya Rao");
  await expect(sheet.getByRole("button", { name: /^Date/ })).toContainText(formatDayMonth(tomorrow));
  await expect(
    sheet.getByRole("combobox", { name: `${appointments.timeLabel}, ${appointments.hourLabel}` }),
  ).toHaveText("2 PM");
  await sheet.getByRole("searchbox", { name: appointments.searchPatients }).fill("Kiran");
  await sheet.getByRole("button", { name: "Kiran Das" }).click();
  await sheet.getByRole("button", { name: appointments.book }).click();
  await expect(sheet).toBeHidden();
  await expect(grid.getByRole("list", { name: "Maya Rao" })).toContainText("2:00 PM – 2:15 PM, Kiran Das");

  // A week is one doctor's (D158).
  await page.getByRole("combobox", { name: calendar.doctor }).click();
  await page.getByRole("option", { name: "Maya Rao" }).click();
  await page.getByRole("radio", { name: calendar.views.WEEK }).click();
  const week = page.getByRole("region", { name: /^Maya Rao’s appointments/ });
  await expect(week).toContainText("Rohan Mehta");
  await expectAccessible(page);
});
