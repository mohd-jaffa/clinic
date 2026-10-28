import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { recordPayment } from "@/features/billing/payments";
import { createExpense } from "@/features/expenses/api";
import { addDaysKey, addMonthsKey, monthStartKey, todayKey } from "@/lib/dates/calendar";
import { formatDate, formatShortDay } from "@/lib/format/date";
import { expenseSchema, paymentSchema, walkInSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Reports (plan §18; R10.3, D345, D346, D354 – D356), at a phone's width and
 * a desktop's. Kavya keeps the clinic's books with `reports.view` alone: the
 * Daily report today — two seen, one cancelled, ₹1,500 collected and ₹250
 * spent — its day-end collections by person and method, printed and saved —
 * then the day before, and back; the Monthly
 * report with both days in it, its chart read column by column and as a
 * table, the outcomes donut, and Maya's month by doctor. The front desk, without `reports.view`,
 * is turned away. Each screen checked by axe, nothing wider than the screen.
 */
test.afterAll(removeAll);

const { reports: words, system } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const fitsTheScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
const figure = (page: Page, section: string, label: string) =>
  page
    .getByRole("region", { name: section })
    .locator("div")
    .filter({ has: page.getByText(label, { exact: true }) });

test("the books: a day's figures, the day before, the month's figures and its two charts", async ({
  page,
  browser,
}) => {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const [maya, books, desk] = await Promise.all([
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "visits.view"] }),
    addMember(clinic.clinicId, { permissions: ["reports.view"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view"] }),
  ]);
  await admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId);
  const [{ data: doctor }, { data: type }, { data: supplies }] = await Promise.all([
    admin().from("doctors").select("id").eq("member_id", maya.memberId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
    admin().from("expense_categories").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Supplies").single(),
  ]);
  const owner = clinic.owner.tenant;
  const patient = async (fullName: string) => {
    const { data, error } = await owner.supabase
      .rpc("create_patient", {
        p_patient: { full_name: fullName, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "FEMALE" },
        p_idempotency_key: randomUUID(),
      })
      .single<{ patient_id: string }>();
    if (error) throw error;
    return data.patient_id;
  };
  const walkIn = (patientId: string) =>
    addWalkIn(
      owner,
      walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId: doctor!.id, typeId: type!.id }),
      randomUUID(),
    );
  const pay = (patientId: string, amount: string, paidOn: string) =>
    recordPayment(
      owner,
      paymentSchema.parse({ patientId, kind: "PAYMENT", amount, paidOn, method: "CASH", reference: "", note: "" }),
      randomUUID(),
    );
  const [anita, rohan, tara] = await Promise.all(["Anita Das", "Rohan Mehta", "Tara Shah"].map(patient));
  // Today: Anita and Rohan seen; Tara cancelled. ₹1,500 in, ₹250 out. Yesterday: ₹400 in.
  for (const seen of [anita, rohan]) {
    const arrival = await walkIn(seen);
    await sendIn(owner, { appointmentId: arrival.id, others: "KEEP" });
    await markDone(owner, { appointmentId: arrival.id });
  }
  const { error: refused } = await owner.supabase.rpc("change_appointment_status", {
    p_appointment_id: (await walkIn(tara)).id,
    p_status: "CANCELLED",
    p_reason: "Had to leave",
  });
  expect(refused).toBeNull();
  const today = todayKey();
  const yesterday = addDaysKey(today, -1);
  await pay(anita, "1000", today);
  await pay(rohan, "500", today);
  await pay(rohan, "400", yesterday);
  await createExpense(
    owner,
    expenseSchema.parse({ categoryId: supplies!.id, amount: "250", day: today, method: "CASH", description: "" }),
    randomUUID(),
    "req_reports",
  );

  // The Daily report, today: the figures as worked out by hand.
  await signIn(page, books.email, books.password);
  await page.goto("/reports");
  await expect(page.getByRole("tab", { name: "Daily" })).toHaveAttribute("aria-selected", "true");
  await expect(figure(page, words.patients, words.patientsSeen)).toContainText("2");
  await expect(figure(page, words.patients, words.appointments)).toContainText("2");
  await expect(figure(page, words.patients, words.cancelled)).toContainText("1");
  await expect(figure(page, words.money, words.collected)).toContainText("₹1,500");
  await expect(figure(page, words.money, words.expenses)).toContainText("₹250");
  await expect(figure(page, words.money, words.net)).toContainText("₹1,250");
  await expect(page.getByRole("button", { name: words.nextDay })).toBeDisabled();
  await fitsTheScreen(page);
  await expectAccessible(page);

  // The day-end collections (D357 – D360): the owner took it all in cash; printed as a PDF, or saved.
  const dayEnd = page.getByRole("region", { name: words.dayEnd });
  const asha = dayEnd.getByRole("list", { name: words.byPerson }).getByRole("listitem");
  await expect(asha).toContainText("Asha Menon");
  await expect(asha).toContainText(`${words.handOver}₹1,500`);
  await expect(
    dayEnd.getByRole("table", { name: words.byMethod }).getByRole("row", { name: "Cash ₹1,500 ₹0 ₹1,500" }),
  ).toBeVisible();
  const day = formatDate(today);
  await expect(dayEnd.getByRole("link", { name: words.printOf(day) })).toHaveAttribute(
    "href",
    `/api/reports/daily/collections.pdf?day=${today}`,
  );
  const saving = page.waitForEvent("download");
  await dayEnd.getByRole("button", { name: words.downloadOf(day) }).click();
  expect((await saving).suggestedFilename()).toBe(`Collections - ${day}.pdf`);
  await expectAccessible(page);

  // The day before: its ₹400 only.
  await page.getByRole("button", { name: words.previousDay }).click();
  await expect(figure(page, words.money, words.collected)).toContainText("₹400");
  await expect(figure(page, words.patients, words.patientsSeen)).toContainText("0");
  await page.getByRole("button", { name: words.nextDay }).click();
  await expect(figure(page, words.money, words.collected)).toContainText("₹1,500");

  // The Monthly report: the month's figures and its two charts.
  await page.getByRole("tab", { name: "Monthly" }).click();
  const sameMonth = monthStartKey(yesterday) === monthStartKey(today);
  await expect(figure(page, words.money, words.collected)).toContainText(sameMonth ? "₹1,900" : "₹1,500");
  await expect(figure(page, words.patients, words.newPatients)).toContainText("2");
  const chart = page.getByRole("figure", { name: words.byDay });
  await chart.getByRole("group").focus();
  await page.keyboard.press("End");
  // The month's last day, read out at the End key.
  const lastDay = addDaysKey(addMonthsKey(monthStartKey(today), 1), -1);
  await expect(chart.locator("[aria-live=polite]")).toContainText(formatShortDay(lastDay));
  await chart.getByRole("button", { name: words.showTable }).click();
  await expect(chart.getByRole("row", { name: `${formatShortDay(today)} ₹1,500 ₹250` })).toBeVisible();
  const outcomes = page.getByRole("list", { name: words.outcomes });
  await expect(outcomes.getByRole("listitem").filter({ hasText: words.completed })).toContainText("2 · 67%");
  await expect(outcomes.getByRole("listitem").filter({ hasText: words.cancelled })).toContainText("1 · 33%");
  await expect(page.getByText(words.outcomeTotal(3))).toBeVisible();
  // By doctor (D361, D362): Maya saw both; nothing was billed this month.
  await expect(page.getByRole("list", { name: words.byDoctor }).getByRole("listitem")).toHaveText([
    `Maya Rao${words.patientsCount(2)} · ${words.visitsCount(2)}${words.billedPaid("₹0", "₹0")}`,
  ]);
  await fitsTheScreen(page);
  await expectAccessible(page);

  // The front desk, without reports.view, is turned away.
  const front = await browser.newContext({ viewport: page.viewportSize()! });
  const frontPage = await front.newPage();
  await signIn(frontPage, desk.email, desk.password);
  await frontPage.goto("/reports");
  await expect(frontPage.getByRole("heading", { level: 1, name: system.noAccessTitle })).toBeVisible();
  await front.close();
});
