import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { createPatient } from "@/features/patients/api";
import { patientSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Importing patients (plan §10.5; R4.8, D127 – D133). The owner imports a
 * CSV from Settings, a step at a time: the file is read on the device; its
 * columns are matched from the headers; its rows are checked — the problems
 * left out with why, a patient already here and a row twice in the file
 * flagged, one ticked to import anyway — then imported, the rows not
 * imported downloaded to fix. A new clinic's owner starts from the empty
 * patients list with an Excel workbook, its date cells and day-first dates
 * read as dates. At a phone's width and a desktop's, each checked by axe.
 */
test.afterAll(removeAll);

const { patientImport, settings } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

/** Chooses a file through the Choose file button, as a person would. */
async function chooseFile(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: patientImport.choose }).click();
  await (await chooser).setFiles(file);
}

const step = (page: Page) => page.locator('[aria-current="step"]');
const figure = (page: Page, label: string) =>
  page
    .getByRole("term")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd[1]");

const CSV = [
  "Name,Mobile,Date of birth,Gender,Notes",
  "Rohan Mehta,98765 01234,12/04/1990,M,already here",
  "Meena Iyer,99000 11223,14/06/1991,F,",
  "Meena Iyer,99000 11223,14/06/1991,F,twice in the file",
  "Kabir Shah,12345,01/01/1980,M,",
  "Zoya Khan,98111 22334,,F,",
  "Leela Nair,98222 33445,31/02/1990,Female,",
].join("\n");

test("the owner imports a CSV, checks its rows and downloads the ones not imported", async ({ page }) => {
  const clinic = await registerClinic({ fullName: "Asha Menon" });
  const typed = { fullName: "Rohan Mehta", phone: "98765 01234", born: { as: "AGE", years: "36" }, gender: "MALE" };
  await createPatient(clinic.owner.tenant, patientSchema.parse(typed), randomUUID());
  await signIn(page, clinic.owner.email, clinic.owner.password);

  await page.goto("/settings");
  await page.getByRole("link", { name: settings.items.import.label }).click();
  await expect(page).toHaveURL(/\/settings\/import$/);
  await expect(page.getByRole("heading", { level: 1, name: patientImport.title })).toBeVisible();
  await expect(step(page)).toContainText(patientImport.steps.FILE);
  await expectAccessible(page);

  await chooseFile(page, { name: "patients.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) });
  await expect(page.getByText(patientImport.chosen("patients.csv", 6))).toBeVisible();
  await page.getByRole("button", { name: patientImport.next }).click();

  await expect(step(page)).toContainText(patientImport.steps.COLUMNS);
  await expect(page.getByRole("combobox", { name: /^Full name/ })).toContainText("A · Name");
  await expect(page.getByRole("combobox", { name: /^Notes/ })).toContainText("E · Notes");
  await expectAccessible(page);
  await page.getByRole("button", { name: patientImport.next }).click();

  await expect(step(page)).toContainText(patientImport.steps.CHECK);
  await expect(figure(page, patientImport.readyLabel)).toHaveText("1");
  await expect(figure(page, patientImport.duplicatesTitle)).toHaveText("2");
  await expect(figure(page, patientImport.problemsTitle)).toHaveText("3");
  const problems = page.getByRole("list", { name: patientImport.problemsTitle });
  await expect(problems.getByRole("listitem")).toHaveText([
    /^Row 5 · Kabir Shah/,
    /^Row 6 · Zoya Khan/,
    /^Row 7 · Leela Nair/,
  ]);
  await expect(problems).toContainText(patientImport.dateUnread);
  const rohan = page.getByRole("checkbox", { name: patientImport.row(2, "Rohan Mehta") });
  await expect(rohan).toHaveAccessibleDescription(patientImport.sameAsPatient("P-1001", "Rohan Mehta"));
  await expect(page.getByRole("checkbox", { name: patientImport.row(4, "Meena Iyer") })).toHaveAccessibleDescription(
    patientImport.sameAsRow(3),
  );
  await rohan.check();
  await expectAccessible(page);
  await page.getByRole("button", { name: patientImport.next }).click();

  await expect(step(page)).toContainText(patientImport.steps.SEND);
  await expect(page.getByText(patientImport.willLeave(1, 3))).toBeVisible();
  await page.getByRole("button", { name: patientImport.send(2) }).click();
  await expect(page.getByRole("heading", { name: patientImport.doneTitle })).toBeVisible();
  await expect(figure(page, patientImport.importedLabel)).toHaveText("2");
  await expect(figure(page, patientImport.skippedLabel)).toHaveText("1");
  await expect(figure(page, patientImport.refusedLabel)).toHaveText("3");
  await expectAccessible(page);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: patientImport.downloadRefused }).click();
  const saved = await download;
  expect(saved.suggestedFilename()).toBe(patientImport.refusedFile);
  const refused = (await readFile((await saved.path())!, "utf8")).replace(/^﻿/, "").split("\r\n");
  expect(refused[0]).toBe(`Name,Mobile,Date of birth,Gender,Notes,${patientImport.problemColumn}`);
  expect(refused.slice(1).map((line) => line.split(",")[0])).toEqual(["Kabir Shah", "Zoya Khan", "Leela Nair"]);

  await page.getByRole("link", { name: patientImport.openPatients }).click();
  const list = page.getByRole("list", { name: UI_TEXT.nav.places.patients });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(list).toContainText("Meena Iyer");
  await expect(list.getByRole("link", { name: /^Rohan Mehta/ })).toHaveCount(2);
});

test("a new clinic's owner imports an Excel workbook from the empty patients list", async ({ page }) => {
  const clinic = await registerClinic({ fullName: "Ravi Kumar" });
  await signIn(page, clinic.owner.email, clinic.owner.password);

  await page.goto("/patients");
  await page.getByRole("link", { name: patientImport.fromEmpty }).click();
  await expect(page).toHaveURL(/\/settings\/import$/);

  const buffer = await readFile(join(process.cwd(), "tests/support/fixtures/patients.xlsx"));
  await chooseFile(page, {
    name: "patients.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await expect(page.getByText(patientImport.chosen("patients.xlsx", 2))).toBeVisible();
  await page.getByRole("button", { name: patientImport.next }).click();
  await expect(page.getByRole("combobox", { name: /^Gender/ })).toContainText("D · Sex");
  await page.getByRole("button", { name: patientImport.next }).click();
  await expect(figure(page, patientImport.readyLabel)).toHaveText("2");
  await page.getByRole("button", { name: patientImport.next }).click();
  await page.getByRole("button", { name: patientImport.send(2) }).click();
  await expect(page.getByRole("heading", { name: patientImport.doneTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: patientImport.downloadRefused })).toBeHidden();

  const { data } = await admin()
    .from("patients")
    .select("full_name, phone, date_of_birth, gender, notes")
    .eq("clinic_id", clinic.clinicId)
    .order("patient_number");
  expect(data).toEqual([
    {
      full_name: "Kavya Menon",
      phone: "+919845001001",
      date_of_birth: "1991-04-03",
      gender: "FEMALE",
      notes: "Prefers evenings",
    },
    { full_name: "Arjun Pillai", phone: "+919845001002", date_of_birth: "1985-08-12", gender: "MALE", notes: null },
  ]);
});
