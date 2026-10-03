import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, registerClinic, removeAll } from "@tests/support/integration";

/**
 * A member's page (plan §8.6; R3.6, D93 – D95): the owner opens a member
 * from the team, changes what they can do and their job title, deactivates
 * them and reactivates them, each asked first; a manager sees someone beyond
 * their own access, and is told it is the owner's to change. At a phone's
 * width and a desktop's, each checked by axe.
 */
test.afterAll(removeAll);

const { actions, member, team } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });

test("the owner changes a member, and deactivates and reactivates them", async ({ page }) => {
  const clinic = await registerClinic();
  await addMember(clinic.clinicId, { permissions: ["patients.view"] });
  await signIn(page, clinic.owner.email, clinic.owner.password);

  await page.goto("/team");
  await page.getByRole("link", { name: "Test staff" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Test staff" })).toBeVisible();
  await expectAccessible(page);

  // What they can do, saved together.
  const save = page.getByRole("button", { name: member.saveAccess });
  await expect(save).toBeDisabled();
  await page.getByRole("checkbox", { name: "Add patients" }).check();
  await save.click();
  await expect(notice(page, member.accessSaved("Test staff"))).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Add patients" })).toBeChecked();

  // The job title, in its sheet.
  await page.getByRole("button", { name: member.jobTitle }).click();
  const sheet = page.getByRole("dialog", { name: member.jobTitleSheet });
  await sheet.getByRole("textbox", { name: /^Job title/ }).fill("Front desk");
  await expectAccessible(page);
  await sheet.getByRole("button", { name: actions.save }).click();
  await expect(page.getByText("Staff · Front desk")).toBeVisible();

  // Deactivated, asked first; then back.
  await page.getByRole("button", { name: member.deactivate }).click();
  const ask = page.getByRole("alertdialog", { name: member.deactivateTitle("Test staff") });
  await expectAccessible(page);
  await ask.getByRole("button", { name: member.deactivate }).click();
  await expect(page.getByText(member.inactive)).toBeVisible();
  // The notice waits while a pointer rests on it; closed, as a person would, it leaves the button clear.
  await page.getByRole("button", { name: UI_TEXT.response.closeNotice(member.deactivated("Test staff")) }).click();
  await page.getByRole("button", { name: member.reactivate }).click();
  await page
    .getByRole("alertdialog", { name: member.reactivateTitle("Test staff") })
    .getByRole("button", { name: member.reactivate })
    .click();
  await expect(page.getByText(member.inactive)).toBeHidden();
  await expect(page.getByRole("button", { name: member.deactivate })).toBeVisible();
});

test("a manager is shown someone beyond their access, not given it to change (D93)", async ({ page }) => {
  const clinic = await registerClinic();
  const manager = await addMember(clinic.clinicId, { permissions: ["team.manage", "patients.view"] });
  const senior = await addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "visits.view"] });
  await signIn(page, manager.email, manager.password);

  await page.goto(`/team/${senior.memberId}`);
  await expect(page.getByText(member.readOnly("Test doctor"))).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: member.deactivate })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: team.accessTitle })).toBeVisible();
  await expectAccessible(page);
});

test("the owner stops and starts seeing patients, and fills in their doctor details (D96, D97)", async ({ page }) => {
  const clinic = await registerClinic({ fullName: "Asha Menon" });
  await signIn(page, clinic.owner.email, clinic.owner.password);

  await page.goto("/team");
  await page.getByRole("link", { name: team.you("Asha Menon") }).click();
  await expect(page.getByText(member.ownAccess)).toBeVisible();
  const sees = page.getByRole("checkbox", { name: member.seesPatients });
  await expect(sees).toBeChecked();
  await expectAccessible(page);

  await page.getByRole("button", { name: member.doctorDetails }).click();
  const sheet = page.getByRole("dialog", { name: member.doctorSheet });
  await sheet.getByRole("textbox", { name: /^Registration number/ }).fill("KL-2041");
  await sheet.getByRole("button", { name: actions.save }).click();
  await expect(page.getByText("Reg. KL-2041")).toBeVisible();

  await sees.uncheck();
  await expect(notice(page, member.seesOff)).toBeVisible();
  await expect(page.getByRole("button", { name: member.doctorDetails })).toHaveCount(0);
  await sees.check();
  await expect(notice(page, member.seesOn)).toBeVisible();
  await expect(page.getByText("Reg. KL-2041")).toBeVisible();
});
