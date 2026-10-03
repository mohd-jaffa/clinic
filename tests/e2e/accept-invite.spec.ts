import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { expectAccessible } from "@tests/support/e2e";
import { aMobileNumber, inviteWithToken, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Accepting an invite (plan §8.5; R3.5, D91, D92): the emailed link opens
 * onto the clinic and the role, its token gone from the address; the
 * invitee confirms their name, adds their mobile, chooses a password and
 * lands on Home signed in as themselves — on a device the owner was signed
 * in on. The same link a second time, or none, says so. At a phone's width
 * and a desktop's, each checked by axe.
 */
test.afterAll(removeAll);

const { acceptInvite } = UI_TEXT;

async function signedInEmail(page: Page): Promise<string> {
  const answer = await page.request.get("/api/auth/session");
  return ((await answer.json()) as { data: { profile: { email: string } } }).data.profile.email;
}

test("an invited receptionist joins, on a device the owner was signed in on", async ({ page }) => {
  const clinic = await registerClinic({ clinicName: "Smile Care" });
  const { email, token } = await inviteWithToken(clinic, { fullName: "Meera Pillai" });
  expect(
    (
      await page.request.post("/api/auth/login", {
        data: { identifier: clinic.owner.email, password: clinic.owner.password },
      })
    ).ok(),
  ).toBe(true);

  await page.goto(`/accept-invite#token=${token}`);
  await expect(page.getByRole("heading", { level: 1, name: acceptInvite.title("Smile Care") })).toBeVisible();
  await expect(page.getByText(acceptInvite.intro(acceptInvite.roles.STAFF, email))).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  await expect(page.getByRole("textbox", { name: /^Your name/ })).toHaveValue("Meera Pillai");
  await expectAccessible(page);

  await page.getByRole("textbox", { name: /^Mobile number/ }).fill(aMobileNumber());
  await page.getByLabel(/^Choose a password/).fill("a good long password");
  await page.getByRole("button", { name: acceptInvite.join }).click();
  await expect(page).toHaveURL(/\/home$/);
  expect(await signedInEmail(page)).toBe(email);

  // The same link again finds no open invite.
  await page.goto("about:blank");
  await page.goto(`/accept-invite#token=${token}`);
  await expect(page.getByRole("heading", { level: 1, name: acceptInvite.invalidTitle })).toBeVisible();
  await expectAccessible(page);
});

test("a link with no invite in it says so, with the way back to sign in", async ({ page }) => {
  await page.goto("/accept-invite");
  await expect(page.getByRole("heading", { level: 1, name: acceptInvite.invalidTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: UI_TEXT.auth.backToSignIn })).toBeVisible();
  await expectAccessible(page);
});
