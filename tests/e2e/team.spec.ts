import { expect, test, type Page } from "@playwright/test";

import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, anEmail, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Inviting the team (plan §8.4; R3.4, D88 – D90): the owner invites a
 * receptionist and a doctor from one sheet; with no mail set up (the
 * journeys send none) each invite is kept and the card says to resend it;
 * Resend says why it could not; Revoke asks first and removes it. A member
 * without team.manage is told the screen is not theirs. At a phone's width
 * and a desktop's, each checked by axe.
 */
test.afterAll(removeAll);

const { actions, team } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const role = (page: Page, name: string) =>
  page.getByRole("radiogroup", { name: team.roleLabel }).getByRole("radio", { name });
const preset = (page: Page, name: string) =>
  page.getByRole("radiogroup", { name: team.presetLabel }).getByRole("radio", { name });

test("the owner invites a receptionist and a doctor, resends and revokes", async ({ page }) => {
  const { owner } = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  await signIn(page, owner.email, owner.password);

  await page.goto("/team");
  await expect(page.getByRole("heading", { level: 1, name: UI_TEXT.nav.places.team })).toBeVisible();
  await expect(page.getByRole("list", { name: team.people })).toContainText("Asha Menon (you)");
  await expectAccessible(page);

  // A receptionist, from the preset staff start with (D88).
  await page.getByRole("button", { name: team.invite, exact: true }).click();
  const sheet = page.getByRole("dialog", { name: team.inviteTitle });
  await expect(role(page, "Staff")).toBeChecked();
  await expect(preset(page, "Receptionist")).toBeChecked();
  await expect(sheet.getByRole("checkbox", { name: "Bill and collect" })).toBeChecked();
  await expect(sheet.getByRole("checkbox", { name: "Give discounts" })).not.toBeChecked();
  await sheet.getByRole("textbox", { name: /^Name/ }).fill("Meera Pillai");
  await sheet.getByRole("textbox", { name: /^Email/ }).fill(anEmail());
  await sheet.getByRole("textbox", { name: /^Job title/ }).fill("Front desk");
  await expectAccessible(page);
  await sheet.getByRole("button", { name: team.send }).click();
  const unsent = page.getByRole("alertdialog", { name: team.invitedNoEmail });
  await expect(unsent).toContainText(team.invitedNoEmailBody);
  await unsent.getByRole("button", { name: actions.close }).click();
  const invited = page.getByRole("list", { name: team.invitedList });
  await expect(invited).toContainText("Meera Pillai");
  await expect(invited).toContainText("Link until");

  // A doctor, with their details.
  await page.getByRole("button", { name: team.invite, exact: true }).click();
  await role(page, "Doctor").click();
  await expect(preset(page, "Doctor")).toBeChecked();
  await sheet.getByRole("textbox", { name: /^Name/ }).fill("Rahul Nair");
  await sheet.getByRole("textbox", { name: /^Email/ }).fill(anEmail());
  await sheet.getByRole("textbox", { name: /^Specialization/ }).fill("Orthodontist");
  await sheet.getByRole("textbox", { name: /^Consultation fee/ }).fill("700");
  await expectAccessible(page);
  await sheet.getByRole("button", { name: team.send }).click();
  await page
    .getByRole("alertdialog", { name: team.invitedNoEmail })
    .getByRole("button", { name: actions.close })
    .click();
  await expect(invited).toContainText("Rahul Nair");

  // Resend says why it could not; Revoke asks first.
  await page.getByRole("button", { name: team.resendNamed("Rahul Nair") }).click();
  await expect(page.getByRole("alertdialog", { name: team.notResent })).toContainText(
    ERROR_MESSAGES.MAIL_NOT_CONFIGURED,
  );
  await page.getByRole("alertdialog", { name: team.notResent }).getByRole("button", { name: actions.close }).click();
  await page.getByRole("button", { name: team.revokeNamed("Meera Pillai") }).click();
  const ask = page.getByRole("alertdialog", { name: team.revokeTitle("Meera Pillai") });
  await expectAccessible(page);
  await ask.getByRole("button", { name: team.revoke }).click();
  await expect(page.getByRole("status").filter({ hasText: team.revoked("Meera Pillai") })).toBeVisible();
  await expect(invited).not.toContainText("Meera Pillai");
});

test("a member without team.manage is told the screen is not theirs", async ({ page }) => {
  const { clinicId } = await registerClinic();
  const member = await addMember(clinicId, { permissions: ["patients.view"] });
  await signIn(page, member.email, member.password);

  await page.goto("/team");
  await expect(page.getByRole("heading", { level: 1, name: UI_TEXT.system.noAccessTitle })).toBeVisible();
  await expectAccessible(page);
});
