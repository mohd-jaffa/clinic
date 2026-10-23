import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT, WHATSAPP_TEXT } from "@/constants/messages";
import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { issueBill } from "@/features/billing/api";
import { billSchema, walkInSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Billing (plan §15.4, §15.6, §10.2; R8.6, D318 – D325, D334 – D336), at a
 * phone's width and a desktop's. The front desk checks out To bill: Kiran's
 * visit marked No charge as a courtesy, Anita's billed from its sheet and
 * back to Billing, where Bills shows it Paid today. Then a payment from the
 * ＋: Anita searched for, the amount filled with what she owes, part paid by
 * UPI; Outstanding offers her dues reminder on WhatsApp, the patients list's
 * Owing tab her chip, and the owner voids the payment from its sheet. And
 * the queue's checkout (D318, D337 – D340): the Queue item and the land's
 * pin say how many wait; the pin jumps to To bill; Kiran billed from there
 * comes back to the queue and reaches Done; Anita's visit is marked No
 * charge by the owner on the visit itself (D319). Each screen checked by
 * axe, nothing wider than the screen.
 */
test.afterAll(removeAll);

const { billing: words, payment, quickActions, queue, nav } = UI_TEXT;
/** Reception's preset (plan §8.3): bills, and no visits. */
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
const tabList = (page: Page, name: string) => page.getByRole("tabpanel").getByRole("list", { name });

/** Smile Care, its phone on file: Dr. Maya Rao at ₹800, a front desk, and Anita's and Kiran's visits, done. */
async function aClinic() {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const [maya, desk] = await Promise.all([
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "visits.view"] }),
    addMember(clinic.clinicId, { permissions: DESK }),
  ]);
  await Promise.all([
    admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId),
    admin().from("doctors").update({ consultation_fee_paise: 80_000 }).eq("member_id", maya.memberId),
    admin().from("clinics").update({ phone: "0484 234 5678" }).eq("id", clinic.clinicId),
  ]);
  const [{ data: doctor }, { data: type }, { data: consultation }] = await Promise.all([
    admin().from("doctors").select("id").eq("member_id", maya.memberId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
    admin().from("services").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  const seen = async (fullName: string, phone: string) => {
    const { data: created, error } = await desk
      .tenant!.supabase.rpc("create_patient", {
        p_patient: { full_name: fullName, phone, date_of_birth: "1990-04-12", gender: "FEMALE" },
        p_idempotency_key: randomUUID(),
      })
      .single<{ patient_id: string }>();
    if (error) throw error;
    const arrival = await addWalkIn(
      desk.tenant!,
      walkInSchema.parse({
        patient: { mode: "FOUND", id: created.patient_id },
        doctorId: doctor!.id,
        typeId: type!.id,
      }),
      randomUUID(),
    );
    const { visitId } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
    await markDone(desk.tenant!, { appointmentId: arrival.id });
    return { patientId: created.patient_id, visitId };
  };
  const anita = await seen("Anita Rao", "+919876543210");
  const kiran = await seen("Kiran Das", "+919876543211");
  return { clinic, desk, anita, kiran, consultation: consultation!.id as string };
}

test("the front desk checks out To bill: No charge, and a bill back to Billing", async ({ page }) => {
  const { desk } = await aClinic();
  await signIn(page, desk.email, desk.password);

  // To bill first, with how many wait (D318).
  await page.goto("/billing");
  await expect(page.getByRole("heading", { level: 1, name: UI_TEXT.nav.places.billing })).toBeVisible();
  await expect(page.getByRole("tab", { name: /^To bill/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /^To bill/ })).toContainText("2");
  const toBill = tabList(page, "To bill");
  await expect(toBill.getByRole("listitem")).toHaveCount(2);
  await expect(toBill).toContainText("Maya Rao");
  await fitsTheScreen(page);
  await expectAccessible(page);

  // Kiran's visit, a courtesy (D319): the row's Bill opens the sheet, No charge its reason.
  await page.getByRole("button", { name: words.checkOut("Kiran Das") }).click();
  const sheet = page.getByRole("dialog", { name: words.visitOf("Kiran Das") });
  await expect(sheet.getByRole("link", { name: words.billNowOf("Kiran Das") })).toBeVisible();
  await expectAccessible(page);
  await sheet.getByRole("button", { name: words.noChargeOf("Kiran Das") }).click();
  const reason = page.getByRole("dialog", { name: words.noCharge });
  await reason.getByRole("radio", { name: "Courtesy" }).click();
  await expectAccessible(page);
  await reason.getByRole("button", { name: words.markNoCharge }).click();
  await expect(notice(page, words.noCharged("Kiran Das"))).toBeVisible();
  await expect(toBill.getByRole("listitem")).toHaveCount(1);

  // Anita's, billed from its sheet, and back to Billing with the card.
  await page.getByRole("button", { name: words.checkOut("Anita Rao") }).click();
  await page
    .getByRole("dialog", { name: words.visitOf("Anita Rao") })
    .getByRole("link", { name: words.billNowOf("Anita Rao") })
    .click();
  await expect(page).toHaveURL(/\/billing\/new\?visit=[0-9a-f-]+&from=billing$/);
  await page.getByRole("button", { name: words.issue }).click();
  await expect(page).toHaveURL(/\/billing$/);
  const card = page.getByRole("dialog", { name: /^Bill \d{4}-\d{2}\/0001 issued$/ });
  await expect(card).toContainText(words.collected("₹800"));
  await card.getByRole("button", { name: UI_TEXT.actions.close }).click();
  await expect(page.getByRole("heading", { name: words.toBillEmpty })).toBeVisible();

  // Bills, today's (D335): Anita's, paid; none unpaid.
  await page.getByRole("tab", { name: "Bills" }).click();
  const bills = tabList(page, "Bills");
  await expect(bills.getByRole("listitem")).toHaveCount(1);
  await expect(bills).toContainText("Anita Rao");
  await expect(bills).toContainText("₹800");
  await expect(bills.getByText("Paid", { exact: true })).toBeVisible();
  await fitsTheScreen(page);
  await expectAccessible(page);
  await page.getByRole("radio", { name: "Unpaid" }).click();
  await expect(page.getByRole("heading", { name: words.billsEmpty })).toBeVisible();
});

test("a payment from the ＋, Outstanding's reminder, the Owing tab, and the owner's void", async ({
  page,
  browser,
}) => {
  const { clinic, desk, anita, consultation } = await aClinic();
  // Anita's visit billed, nothing paid: ₹800 due.
  await issueBill(
    desk.tenant!,
    billSchema.parse({
      patientId: anita.patientId,
      visitId: anita.visitId,
      appointmentId: null,
      lines: [{ kind: "SERVICE", serviceId: consultation, treatmentId: null, quantity: 1, price: "800" }],
      discount: { kind: "NONE" },
      notes: "",
      collect: { on: false },
    }),
    randomUUID(),
  );
  await signIn(page, desk.email, desk.password);

  // The ＋'s Payment: Billing with the sheet, searching first (D323); the amount what she owes (D324).
  await page.goto("/home");
  await page.getByRole("button", { name: quickActions.title }).click();
  await page
    .getByRole("dialog", { name: quickActions.title })
    .getByRole("link", { name: quickActions.payment })
    .click();
  await expect(page).toHaveURL(/\/billing\?add=payment$/);
  const sheet = page.getByRole("dialog", { name: payment.title });
  await sheet.getByRole("searchbox").fill("anita");
  await sheet.getByRole("button", { name: "Anita Rao" }).click();
  await expect(sheet.getByText(payment.balance(words.due("₹800")))).toBeVisible();
  const amount = sheet.getByRole("textbox", { name: new RegExp(`^${payment.amountLabel}`) });
  await expect(amount).toHaveValue("800");
  await amount.fill("500");
  await sheet.getByRole("radio", { name: "UPI" }).click();
  await expectAccessible(page);
  await sheet.getByRole("button", { name: payment.record }).click();
  await expect(notice(page, payment.recorded("₹500", "Anita Rao"))).toContainText(
    payment.balanceNow(words.due("₹300")),
  );

  // Outstanding: her dues reminder on WhatsApp, from the clinic (D321).
  await page.getByRole("tab", { name: "Outstanding" }).click();
  const owing = tabList(page, "Outstanding");
  await expect(owing).toContainText("₹300 due");
  const reminder = owing.getByRole("link", { name: words.remindDues("Anita Rao") });
  expect(decodeURIComponent((await reminder.getAttribute("href"))!)).toContain(
    WHATSAPP_TEXT.duesReminder("Anita", "₹300", "Smile Care", "0484 234 5678"),
  );
  await fitsTheScreen(page);
  await expectAccessible(page);

  // Payments, today's: hers by UPI.
  await page.getByRole("tab", { name: "Payments" }).click();
  await expect(tabList(page, "Payments")).toContainText("Paid ₹500 · UPI");
  await expectAccessible(page);

  // The patients list's Owing tab, with her chip (D101).
  await page.goto("/patients");
  await page.getByRole("tab", { name: "Owing" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Anita Rao");
  await expect(page.getByRole("tabpanel")).toContainText("₹300 due");
  await expectAccessible(page);

  // The owner voids it from its sheet, asked first (D336).
  const owner = await browser.newContext({ viewport: page.viewportSize()! });
  const ownerPage = await owner.newPage();
  await signIn(ownerPage, clinic.owner.email, clinic.owner.password);
  await ownerPage.goto("/billing");
  await ownerPage.getByRole("tab", { name: "Payments" }).click();
  await tabList(ownerPage, "Payments").getByRole("button", { name: "Anita Rao" }).click();
  const opened = ownerPage.getByRole("dialog", { name: "Payment" });
  await expect(opened).toContainText("₹500");
  await expectAccessible(ownerPage);
  await opened.getByRole("button", { name: payment.void }).click();
  const why = ownerPage.getByRole("dialog", { name: payment.void });
  await why.getByRole("textbox", { name: new RegExp(`^${payment.voidReasonLabel}`) }).fill("Entered twice");
  await why.getByRole("button", { name: payment.void }).click();
  await ownerPage
    .getByRole("alertdialog", { name: payment.voidAsk("₹500") })
    .getByRole("button", { name: payment.void })
    .click();
  await expect(notice(ownerPage, payment.voided)).toContainText(payment.balanceNow(words.due("₹800")));
  await expect(tabList(ownerPage, "Payments").getByText("Void", { exact: true })).toBeVisible();
  await owner.close();
});

test("the queue's To bill: the count and the pin, a bill back to the queue, Done; No charge on the visit", async ({
  page,
  browser,
}) => {
  const { clinic, desk, anita } = await aClinic();
  await signIn(page, desk.email, desk.password);

  // The Queue item counts the two waiting (D337); the land's pin too, and jumps to To bill (D340).
  await page.goto("/queue");
  await expect(page.getByRole("link", { name: nav.counted(nav.places.queue, words.toBillCount(2)) })).toBeVisible();
  const pin = page.getByRole("link", { name: words.toBillCount(2), exact: true });
  await pin.click();
  await expect(page).toHaveURL(/\/queue#to-bill$/);
  const toBill = page.getByRole("list", { name: queue.toBill });
  await expect(toBill).toBeInViewport();
  await expect(toBill.getByRole("listitem")).toHaveCount(2);
  await fitsTheScreen(page);
  await expectAccessible(page);

  // Kiran billed from the queue, and back to it with the card (D318).
  await page.getByRole("button", { name: words.checkOut("Kiran Das") }).click();
  await page
    .getByRole("dialog", { name: words.visitOf("Kiran Das") })
    .getByRole("link", { name: words.billNowOf("Kiran Das") })
    .click();
  await expect(page).toHaveURL(/\/billing\/new\?visit=[0-9a-f-]+&from=queue$/);
  await page.getByRole("button", { name: words.issue }).click();
  await expect(page).toHaveURL(/\/queue$/);
  const card = page.getByRole("dialog", { name: /^Bill \d{4}-\d{2}\/0001 issued$/ });
  await card.getByRole("button", { name: UI_TEXT.actions.close }).click();

  // One waits now; Kiran is Done, once billed (D339).
  await expect(toBill.getByRole("listitem")).toHaveCount(1);
  await expect(toBill).not.toContainText("Kiran Das");
  await expect(page.getByRole("link", { name: words.toBillCount(1), exact: true })).toBeVisible();
  if (page.viewportSize()!.width < 768) await page.getByRole("button", { name: queue.doneCount(1) }).click();
  await expect(page.getByRole("list", { name: queue.done })).toContainText("Kiran Das");
  await fitsTheScreen(page);
  await expectAccessible(page);

  // Anita's visit, marked No charge by the owner on the visit itself (D319).
  const owner = await browser.newContext({ viewport: page.viewportSize()! });
  const ownerPage = await owner.newPage();
  await signIn(ownerPage, clinic.owner.email, clinic.owner.password);
  await ownerPage.goto(`/visits/${anita.visitId}`);
  await expect(ownerPage.getByRole("link", { name: words.billNowOf("Anita Rao") })).toBeVisible();
  await ownerPage.getByRole("button", { name: words.noChargeOf("Anita Rao") }).click();
  const reason = ownerPage.getByRole("dialog", { name: words.noCharge });
  await reason.getByRole("radio", { name: "Review" }).click();
  await expectAccessible(ownerPage);
  await reason.getByRole("button", { name: words.markNoCharge }).click();
  await expect(notice(ownerPage, words.noCharged("Anita Rao"))).toBeVisible();
  await expect(ownerPage.getByRole("button", { name: words.noChargeOf("Anita Rao") })).toBeHidden();
  await expect(ownerPage.getByText("No charge", { exact: true })).toBeVisible();
  await expect(ownerPage.getByRole("link", { name: nav.places.queue, exact: true })).toBeVisible();
  await expectAccessible(ownerPage);
  await owner.close();
});
