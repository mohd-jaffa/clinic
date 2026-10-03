import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { authLinkTo, expectAccessible } from "@tests/support/e2e";
import { aMobileNumber, anEmail, deleteAfter, registerClinic, removeAll, userIdOf } from "@tests/support/integration";

/**
 * The account screens (plan §5, D70): sign in, sign up, confirm the email,
 * forgot and reset the password — at a phone's width and a desktop's, each
 * checked by axe. The links are made as the app's emails make them, and
 * followed as a person taps them.
 */
test.afterAll(removeAll);

const { auth } = UI_TEXT;

const field = (page: Page, name: RegExp) => page.getByRole("textbox", { name });

test("signing in: refused in the API's words, then in, at the screen they were heading for", async ({ page }) => {
  const { owner } = await registerClinic({ fullName: "Asha Menon" });

  await page.goto("/patients");
  await expect(page).toHaveURL(/\/login\?next=%2Fpatients$/);
  await expect(page.getByRole("heading", { level: 1, name: auth.signIn })).toBeVisible();
  await expect(page).toHaveTitle(`${auth.signIn} · ${UI_TEXT.appName}`);
  await expectAccessible(page);

  await field(page, /Email or mobile number/).fill(owner.email);
  await page.getByLabel(/^Password/).fill("not-the-password");
  await page.getByRole("button", { name: auth.signIn }).click();
  const card = page.getByRole("alertdialog", { name: auth.signInFailed });
  await expect(card).toBeVisible();
  await expectAccessible(page);
  await card.getByRole("button", { name: UI_TEXT.actions.close }).click();

  await field(page, /Email or mobile number/).fill(owner.phone);
  await page.getByLabel(/^Password/).fill(owner.password);
  await page.getByRole("button", { name: auth.signIn }).click();
  await expect(page).toHaveURL(/\/patients$/);
});

test("signing up: you, then your clinic, then Check your email — and the link signs the owner in", async ({ page }) => {
  const email = anEmail();
  await page.goto("/register");
  await expect(page.getByRole("heading", { level: 1, name: auth.registerTitle })).toBeVisible();
  await expectAccessible(page);

  await field(page, /^Your name/).fill("Asha Menon");
  await field(page, /^Email/).fill(email);
  await field(page, /^Mobile number/).fill(aMobileNumber());
  await page.getByLabel(/^Password/).fill("Test-password-1");
  await page.getByRole("checkbox", { name: auth.seesPatients }).check();
  await page.getByRole("button", { name: auth.next }).click();

  await expect(page.getByRole("heading", { level: 2, name: auth.stepClinic })).toBeFocused();
  await field(page, /^Clinic name/).fill("Smile Care Dental");
  await page.getByRole("combobox", { name: /^Clinic type/ }).click();
  await page.getByRole("option", { name: "Dental" }).click();
  await field(page, /^City/).fill("Kochi");
  await field(page, /^Address/).fill("12 MG Road");
  await expectAccessible(page);
  await page.getByRole("button", { name: auth.createClinic }).click();

  await expect(page.getByRole("heading", { level: 1, name: auth.checkEmailTitle })).toBeFocused();
  await expect(page.getByText(auth.checkEmailSent(email))).toBeVisible();
  deleteAfter({ userId: await userIdOf(email) });
  await expectAccessible(page);

  await page.goto(await authLinkTo("magiclink", email, "/confirm-email"));
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { level: 1, name: UI_TEXT.home.greeting("Asha") })).toBeVisible();
});

test("confirming with a spent link, or none, offers the link again", async ({ page }) => {
  // Each arrives as a page of its own: a change of fragment alone is not a new page.
  await page.goto("/confirm-email#error=access_denied&error_code=otp_expired");
  await expect(page.getByRole("heading", { level: 1, name: auth.linkExpiredTitle })).toBeVisible();
  await expect(page).toHaveURL(/\/confirm-email$/);
  await expectAccessible(page);

  await page.goto("/confirm-email");
  await expect(page.getByRole("heading", { level: 1, name: auth.checkEmailTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: auth.resendLink })).toBeVisible();
  await expectAccessible(page);
});

test("a forgotten password: a link asked for, the new one chosen, and the person signed in", async ({ page }) => {
  const { owner } = await registerClinic({ fullName: "Asha Menon" });

  await page.goto("/login");
  await page.getByRole("link", { name: auth.forgotPassword }).click();
  await expect(page.getByRole("heading", { level: 1, name: auth.forgotTitle })).toBeVisible();
  await expectAccessible(page);
  // The same answer whether or not the address has an account; no mail goes from the journeys.
  await field(page, /^Email/).fill(anEmail());
  await page.getByRole("button", { name: auth.sendLink }).click();
  const sent = page.getByRole("dialog", { name: auth.checkEmailTitle });
  await expect(sent).toBeVisible();
  await expectAccessible(page);
  await sent.getByRole("button", { name: UI_TEXT.actions.close }).click();

  await page.goto(await authLinkTo("recovery", owner.email, "/reset-password"));
  await expect(page.getByRole("heading", { level: 1, name: auth.resetTitle })).toBeVisible();
  await expect(page).toHaveURL(/\/reset-password$/);
  await expectAccessible(page);
  await page.getByLabel(/^New password/).fill("A-new-password-2");
  await page.getByRole("button", { name: auth.savePassword }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.context().clearCookies();
  await page.goto("/login");
  await field(page, /Email or mobile number/).fill(owner.email);
  await page.getByLabel(/^Password/).fill("A-new-password-2");
  await page.getByRole("button", { name: auth.signIn }).click();
  await expect(page).toHaveURL(/\/home$/);

  // The link is spent, and a visit with none is sent to ask for a new one.
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { level: 1, name: auth.linkExpiredTitle })).toBeVisible();
  await expectAccessible(page);
});
