import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { PERMISSION_PRESET_SETS } from "@/constants/permissions";
import { createPatient } from "@/features/patients/api";
import { formatLongDate } from "@/lib/format/date";
import { patientSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, aMobileNumber, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Adding a patient (plan §10.1; R4.2, D105 – D109): a receptionist starts
 * from the ＋, finds the family already on the mobile typed, adds a brother
 * by his age, and lands on his profile with his number — Back leads to the
 * list, not the form. The owner gives a date of birth decades back through
 * the calendar's year and month jump. At a phone's width and a desktop's,
 * each checked by axe.
 */
test.afterAll(removeAll);

const { patients, quickActions, datePicker } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

/** The patient the profile's address names, as the database holds them — the profile itself is R4.4. */
async function added(page: Page) {
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").pop();
  const { data } = await admin()
    .from("patients")
    .select("full_name, patient_number, date_of_birth, dob_is_estimated, gender")
    .eq("id", id!)
    .single();
  return data;
}

test("a receptionist adds a brother to a family already on file, from the ＋", async ({ page }) => {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const receptionist = await addMember(clinic.clinicId, {
    permissions: [...PERMISSION_PRESET_SETS.RECEPTIONIST.permissions],
  });
  const mobile = aMobileNumber();
  for (const [fullName, date] of [
    ["Anita Mehta", "1991-06-14"],
    ["Riya Mehta", "2020-02-03"],
  ]) {
    const typed = { fullName, phone: mobile, born: { as: "DATE", date }, gender: "FEMALE" };
    await createPatient(clinic.owner.tenant, patientSchema.parse(typed), randomUUID());
  }
  await signIn(page, receptionist.email, receptionist.password);

  await page.goto("/home");
  await page.getByRole("button", { name: quickActions.title }).click();
  await page
    .getByRole("dialog", { name: quickActions.title })
    .getByRole("link", { name: quickActions.patient })
    .click();
  await expect(page).toHaveURL(/\/patients\?add=patient$/);
  const sheet = page.getByRole("dialog", { name: patients.addTitle });
  await expect(sheet).toBeVisible();
  await expectAccessible(page);

  await sheet.getByRole("textbox", { name: /^Full name/ }).fill("Kabir Mehta");
  await sheet.getByRole("textbox", { name: /^Mobile/ }).fill(mobile);
  const family = sheet.getByRole("region", { name: patients.matchesTitle(2) });
  await expect(family.getByRole("link")).toHaveText([/^Riya Mehta/, /^Anita Mehta/]);
  await expectAccessible(page);

  await sheet.getByRole("radio", { name: patients.bornAs.AGE }).click();
  await sheet.getByRole("textbox", { name: /^Age in years/ }).fill("9");
  await sheet.getByRole("radio", { name: "Male", exact: true }).click();
  await sheet.getByRole("button", { name: patients.add }).click();

  expect(await added(page)).toMatchObject({
    full_name: "Kabir Mehta",
    patient_number: 1003,
    dob_is_estimated: true,
    gender: "MALE",
  });
  await page.goBack();
  await expect(page).toHaveURL(/\/home$/);
});

test("the owner gives a date of birth decades back through the calendar's jump (D109)", async ({ page }) => {
  const { owner } = await registerClinic({ fullName: "Asha Menon" });
  await signIn(page, owner.email, owner.password);

  await page.goto("/patients");
  await page.getByRole("button", { name: patients.add }).click();
  await expect(page).toHaveURL(/\/patients\?add=patient$/);
  const sheet = page.getByRole("dialog", { name: patients.addTitle });
  await sheet.getByRole("textbox", { name: /^Full name/ }).fill("Leela George");
  await sheet.getByRole("textbox", { name: /^Mobile/ }).fill(aMobileNumber());

  await sheet.getByRole("button", { name: /^Date of birth/ }).click();
  const calendar = page.getByRole("dialog", { name: datePicker.calendar(patients.dateOfBirthLabel) });
  await calendar.getByRole("button", { name: /choose another month/ }).click();
  await calendar.getByRole("button", { name: /choose another year/ }).click();
  await expectAccessible(page);
  for (let page_ = 0; page_ < 3; page_ += 1)
    await calendar.getByRole("button", { name: datePicker.earlierYears }).click();
  await calendar.getByRole("button", { name: "1985" }).click();
  await calendar.getByRole("button", { name: "April 1985" }).click();
  await calendar.getByRole("button", { name: formatLongDate("1985-04-12") }).click();
  await expect(sheet.getByRole("button", { name: /^Date of birth/ })).toContainText("12 Apr 1985");

  await sheet.getByRole("radio", { name: "Female" }).click();
  await sheet.getByRole("button", { name: patients.add }).click();
  expect(await added(page)).toEqual({
    full_name: "Leela George",
    patient_number: 1001,
    date_of_birth: "1985-04-12",
    dob_is_estimated: false,
    gender: "FEMALE",
  });
  // The add form is gone from where Back leads.
  await page.goBack();
  await expect(page).toHaveURL(/\/patients$/);
  await expect(page.getByRole("dialog", { name: patients.addTitle })).toBeHidden();
});
