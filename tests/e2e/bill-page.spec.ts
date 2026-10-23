import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT, WHATSAPP_TEXT } from "@/constants/messages";
import type { Permission } from "@/constants/permissions";
import { BILL_STATUS_LABELS } from "@/constants/statuses";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { todayKey } from "@/lib/dates/calendar";
import { formatNearDate } from "@/lib/format/date";
import { walkInSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * A bill's page and its PDF (plan §15.2, §15.5; R8.5, D314 – D317), at a
 * phone's width and a desktop's. The owner bills Anita's visit, part paid;
 * the card stays up with Print and View bill (D317). The bill's page shows
 * its lines and figures; Print opens the PDF, Download saves it under her
 * name and its number. Voided with a reason, it says so, and Re-issue opens
 * a new bill filled with its lines, issued as the next number. Reception
 * reads the bill and may not void it. Each screen checked by axe.
 */
test.afterAll(removeAll);

const { bill: words, billing } = UI_TEXT;
const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "payments.view",
  "payments.create",
];

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const notice = (page: Page, title: string | RegExp) => page.getByRole("status").filter({ hasText: title });
const fitsTheScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
const figure = (page: Page, label: string) =>
  page
    .locator("dt")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("+ dd");

/** Smile Care: Dr. Maya Rao at ₹800, a front desk, and Anita's visit with her, done. */
async function aClinic() {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const [maya, desk] = await Promise.all([
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "visits.view"] }),
    addMember(clinic.clinicId, { permissions: DESK }),
  ]);
  await Promise.all([
    admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId),
    admin().from("doctors").update({ consultation_fee_paise: 80_000 }).eq("member_id", maya.memberId),
  ]);
  const [{ data: doctor }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id").eq("member_id", maya.memberId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  const { data: created, error } = await desk
    .tenant!.supabase.rpc("create_patient", {
      p_patient: { full_name: "Anita Rao", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "FEMALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: created.patient_id }, doctorId: doctor!.id, typeId: type!.id }),
    randomUUID(),
  );
  const { visitId } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
  await markDone(desk.tenant!, { appointmentId: arrival.id });
  return { clinic, desk, visitId };
}

test("a bill's page: printed, downloaded, voided with a reason, and issued again", async ({ page, browser }) => {
  const { clinic, desk, visitId } = await aClinic();
  await signIn(page, clinic.owner.email, clinic.owner.password);

  // Issued part paid; the card stays with Print and View bill (D317).
  await page.goto(`/billing/new?visit=${visitId}`);
  const amount = page.getByRole("textbox", { name: new RegExp(`^${billing.amountLabel}`) });
  await amount.fill("500");
  await page.getByRole("button", { name: billing.issue }).click();
  await expect(page).toHaveURL(new RegExp(`/visits/${visitId}$`));
  const card = page.getByRole("dialog", { name: /^Bill \d{4}-\d{2}\/0001 issued$/ });
  await expect(card).toContainText(billing.collected("₹500"));
  const print = card.getByRole("link", { name: words.print });
  await expect(print).toHaveAttribute("href", /^\/api\/bills\/[0-9a-f-]+\/bill\.pdf$/);
  await expect(print).toHaveAttribute("target", "_blank");
  await expectAccessible(page);
  await card.getByRole("link", { name: billing.viewBill }).click();

  // Its page (D314): the lines and figures, part paid.
  await expect(page).toHaveURL(/\/bills\/[0-9a-f-]+$/);
  const billUrl = page.url();
  const number = (await page.getByRole("heading", { level: 1 }).textContent())!.replace(/^Bill /, "");
  expect(number).toMatch(/^\d{4}-\d{2}\/0001$/);
  await expect(page.getByText("Part paid")).toBeVisible();
  await expect(page.getByRole("region", { name: billing.linesTitle })).toContainText("Consultation");
  await expect(figure(page, billing.total)).toHaveText("₹800");
  await expect(figure(page, words.paid)).toHaveText("₹500");
  await expect(figure(page, words.due)).toHaveText("₹300");
  await expect(figure(page, words.balance)).toHaveText(billing.due("₹300"));
  await fitsTheScreen(page);
  await expectAccessible(page);

  // Print opens the PDF itself; Download saves it under her name and its number.
  const opened = await page.request.get(
    (await page.getByRole("link", { name: words.printOf(number) }).getAttribute("href"))!,
  );
  expect(opened.headers()["content-type"]).toBe("application/pdf");
  expect((await opened.body()).subarray(0, 4).toString()).toBe("%PDF");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: words.downloadOf(number) }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`Anita Rao - Bill ${number.replace("/", "-")}.pdf`);
  await expect(notice(page, words.downloaded)).toBeVisible();

  // Reception reads it, and may not void it.
  const deskContext = await browser.newContext({ viewport: page.viewportSize()! });
  const deskPage = await deskContext.newPage();
  await signIn(deskPage, desk.email, desk.password);
  await deskPage.goto(billUrl);
  await expect(deskPage.getByRole("heading", { name: `Bill ${number}` })).toBeVisible();
  await expect(deskPage.getByRole("button", { name: words.void })).toHaveCount(0);
  await deskContext.close();

  // Voided with a reason, asked first (D314).
  await page.getByRole("button", { name: words.void }).click();
  const sheet = page.getByRole("dialog", { name: words.voidTitle });
  await sheet.getByRole("textbox", { name: new RegExp(`^${words.voidReasonLabel}`) }).fill("Wrong amount");
  await expectAccessible(page);
  await sheet.getByRole("button", { name: words.void }).click();
  await page
    .getByRole("alertdialog", { name: words.voidAsk(number) })
    .getByRole("button", { name: words.void })
    .click();
  await expect(notice(page, words.voided(number))).toContainText(words.visitBackToBill);
  await expect(page.getByText(BILL_STATUS_LABELS.VOID, { exact: true })).toBeVisible();
  await expect(page.getByText("Void: Wrong amount")).toBeVisible();
  await expect(page.getByText(/^Voided .* by Asha Menon$/)).toBeVisible();
  await expect(figure(page, words.balance)).toHaveText(billing.advance("₹500"));
  await expectAccessible(page);

  // Re-issued: a new bill filled with its lines, the next number, back on the visit.
  await page.getByRole("link", { name: words.reissueOf(number) }).click();
  await expect(page).toHaveURL(new RegExp(`/billing/new\\?visit=${visitId}&reissue=`));
  await expect(page.getByRole("region", { name: billing.linesTitle })).toContainText("Consultation");
  await page.getByRole("checkbox", { name: billing.collectNow }).uncheck();
  await page.getByRole("button", { name: billing.issue }).click();
  await expect(page).toHaveURL(new RegExp(`/visits/${visitId}$`));
  await expect(page.getByRole("dialog", { name: /^Bill \d{4}-\d{2}\/0002 issued$/ })).toBeVisible();
});

/** What a phone's share sheet was handed, kept on the page: the test cannot pick WhatsApp. */
interface Shared {
  name: string;
  type: string;
  head: string;
  text?: string;
}

test("WhatsApp sends a bill with its total and what is due: from the issued card and its page (D327, D341)", async ({
  browser,
  page,
}, info) => {
  const { clinic, visitId } = await aClinic();
  /** The bill issued part paid, ₹500 of ₹800: its number, and the message it is sent with. */
  const issuedOn = async (on: Page) => {
    await on.goto(`/billing/new?visit=${visitId}`);
    await on.getByRole("textbox", { name: new RegExp(`^${billing.amountLabel}`) }).fill("500");
    await on.getByRole("button", { name: billing.issue }).click();
    const card = on.getByRole("dialog", { name: /^Bill \d{4}-\d{2}\/0001 issued$/ });
    const number = (await card.getByRole("heading").first().textContent())!.match(/\d{4}-\d{2}\/0001/)![0];
    const text = WHATSAPP_TEXT.bill(number, "Smile Care", formatNearDate(todayKey()), "₹800", "₹300");
    return { card, number, text, name: `Anita Rao - Bill ${number.replace("/", "-")}.pdf` };
  };

  if (info.project.name === "phone") {
    // A phone touched first, whose share sheet takes files.
    const phone = await browser.newContext({
      baseURL: info.project.use.baseURL,
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    await phone.addInitScript(() => {
      const shared: Shared[] = [];
      Object.assign(window, { shared });
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: (data: ShareData) => Boolean(data.files?.length),
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async ({ files, text: message }: ShareData) => {
          const [file] = files!;
          shared.push({ name: file.name, type: file.type, head: await file.slice(0, 4).text(), text: message });
        },
      });
    });
    const tapped = await phone.newPage();
    await signIn(tapped, clinic.owner.email, clinic.owner.password);
    const { card, number, text, name } = await issuedOn(tapped);
    await card.getByRole("link", { name: billing.viewBill }).tap();
    await tapped.getByRole("button", { name: words.whatsAppOf(number) }).tap();
    await expect(tapped.getByRole("status").filter({ hasText: words.shared })).toBeVisible();
    expect(await tapped.evaluate(() => (window as unknown as { shared: Shared[] }).shared)).toEqual([
      { name, type: "application/pdf", head: "%PDF", text },
    ]);
    await expectAccessible(tapped);
    await phone.close();
    return;
  }

  // A desktop: her chat opens on WhatsApp Web with the message, and the PDF downloads to attach — from the card.
  await page
    .context()
    .route("https://wa.me/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>WhatsApp</title>" }));
  await signIn(page, clinic.owner.email, clinic.owner.password);
  const { card, number, text, name } = await issuedOn(page);
  await expectAccessible(page);
  const [chat, download] = await Promise.all([
    page.context().waitForEvent("page"),
    page.waitForEvent("download"),
    card.getByRole("button", { name: words.whatsApp }).click(),
  ]);
  expect(chat.url()).toBe(`https://wa.me/919876543210?text=${encodeURIComponent(text)}`);
  await chat.close();
  expect(download.suggestedFilename()).toBe(name);
  await expect(page.getByRole("dialog", { name: words.attachTitle })).toContainText(words.attachBody(name));
  await expectAccessible(page);

  // And from its page; a void bill offers none.
  await page
    .getByRole("dialog", { name: words.attachTitle })
    .getByRole("button", { name: UI_TEXT.actions.close })
    .click();
  await page.goto("/billing");
  await page.getByRole("tab", { name: "Bills" }).click();
  await page
    .getByRole("tabpanel")
    .getByRole("link", { name: /Anita Rao/ })
    .click();
  const [again] = await Promise.all([
    page.context().waitForEvent("page"),
    page.getByRole("button", { name: words.whatsAppOf(number) }).click(),
  ]);
  expect(again.url()).toBe(`https://wa.me/919876543210?text=${encodeURIComponent(text)}`);
  await again.close();
});
