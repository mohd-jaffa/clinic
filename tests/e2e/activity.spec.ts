import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { recordPayment } from "@/features/billing/payments";
import { createPatient } from "@/features/patients/api";
import { todayKey } from "@/lib/dates/calendar";
import { patientSchema, paymentSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, registerClinic, removeAll } from "@tests/support/integration";

/**
 * The owner's activity log (plan §19; R11.6, D387 – D390), at a phone's
 * width and a desktop's: from Settings, what the front desk did today under
 * its day, the payment with its patient by name and number; kept to a kind;
 * a row opened whole, and on to the patient. A member of staff is told it is
 * not theirs.
 * Each screen checked by axe, nothing wider than it.
 */
test.afterAll(removeAll);

const { activity: words } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const fitsTheScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );

test("the owner reads who did what: today's payment by the desk, kept to a kind, opened whole", async ({ page }) => {
  const clinic = await registerClinic({ fullName: "Asha Menon" });
  const desk = await addMember(clinic.clinicId, {
    permissions: ["patients.view", "patients.create", "payments.create"],
  });
  const patient = await createPatient(
    clinic.owner.tenant,
    patientSchema.parse({
      fullName: "Meena Iyer",
      phone: "99000 11223",
      born: { as: "AGE", years: "41" },
      gender: "FEMALE",
    }),
    randomUUID(),
  );
  await recordPayment(
    desk.tenant!,
    paymentSchema.parse({
      patientId: patient.id,
      kind: "PAYMENT",
      amount: "1,300",
      paidOn: todayKey(),
      method: "UPI",
      reference: "",
      note: "",
    }),
    randomUUID(),
  );

  await signIn(page, clinic.owner.email, clinic.owner.password);
  await page.goto("/settings");
  await page.getByRole("link", { name: new RegExp(`^${UI_TEXT.settings.items.activity.label}`) }).click();
  await expect(page).toHaveURL(/\/settings\/activity$/);
  await expect(page.getByRole("heading", { level: 1, name: words.title })).toBeVisible();

  // Today: the payment, its patient by name and number, who took it.
  const todays = page.getByRole("list", { name: words.today });
  const payment = todays.getByRole("listitem").filter({ hasText: "Recorded a payment of ₹1,300 · UPI" });
  await expect(payment).toContainText(`Meena Iyer · P-${patient.number}`);
  await expect(payment).toContainText(desk.session.profile.fullName);
  await expect(todays).toContainText("Added a patient");
  await fitsTheScreen(page);
  await expectAccessible(page);

  // Kept to a kind.
  await page.getByRole("combobox", { name: words.kind }).click();
  await page.getByRole("option", { name: "Bills and payments" }).click();
  await expect(todays.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("Added a patient")).toBeHidden();

  // Opened whole, and on to the patient.
  await todays.getByRole("button", { name: /Recorded a payment of ₹1,300 · UPI/ }).click();
  const sheet = page.getByRole("dialog", { name: "Recorded a payment of ₹1,300 · UPI" });
  await expect(sheet).toContainText("₹1,300");
  await expectAccessible(page);
  await sheet.getByRole("link", { name: words.openPatient }).click();
  await expect(page).toHaveURL(new RegExp(`/patients/${patient.id}$`));
});

test("the activity log is the owner's alone: a member of staff is told it is not theirs", async ({ page }) => {
  const clinic = await registerClinic();
  const desk = await addMember(clinic.clinicId, { permissions: ["patients.view"] });
  await signIn(page, desk.email, desk.password);
  await page.goto("/settings/activity");
  await expect(page.getByRole("heading", { level: 1, name: UI_TEXT.system.noAccessTitle })).toBeVisible();
  await expectAccessible(page);
});
