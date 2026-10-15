import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import type { Permission } from "@/constants/permissions";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { formatDayMonth, formatLongDate } from "@/lib/format/date";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * The follow-ups screen (plan §14.3; R7.4, D267 – D278), at a phone's width
 * and a desktop's. Smile Care has one follow-up in each tab: Anita's root
 * canal due today, Rohan's review four days overdue, Kiran's crown with Dr.
 * Ravi Iyer in three days, Meena's review lapsed, and Divya's treatment
 * completed today. The front desk reminds Anita on WhatsApp — noted as
 * Reminder sent, by them (D273, D275) — and marks her call as No answer,
 * back in 3 days, which takes her off the lists and their counts (D271,
 * D274); books Kiran from his row, which closes his follow-up (D276); and
 * finds Divya's completed treatment with only Call and the profile (D277).
 * Dr. Ravi Iyer sees only his own patient's; a member who only reads the
 * appointments sees the list and the reminder, but neither books nor notes
 * (D267). Each screen checked by axe.
 */
test.afterAll(removeAll);

const { followUps: words, appointment, appointments, patients } = UI_TEXT;
const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit"];
const DAY = 86_400_000;
const today = todayKey();

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });
const fitsTheScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
const tab = (page: Page, name: string, count: number) => page.getByRole("tab", { name: `${name} ${count}` });

/** Smile Care, its phone on the reminder, with a follow-up in each tab. */
async function aClinic() {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const [maya, ravi, desk, reader] = await Promise.all([
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
    addMember(clinic.clinicId, {
      permissions: [
        "patients.view",
        "patients.create",
        "appointments.view",
        "appointments.create",
        "appointments.edit",
      ],
    }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view"] }),
  ]);
  await Promise.all([
    admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId),
    admin().from("profiles").update({ full_name: "Ravi Iyer" }).eq("id", ravi.userId),
    admin().from("profiles").update({ full_name: "Priya Shah" }).eq("id", desk.userId),
    admin().from("clinics").update({ phone: "0484 234 5678" }).eq("id", clinic.clinicId),
  ]);
  const [{ data: mayaDoctor }, { data: raviDoctor }] = await Promise.all([
    admin().from("doctors").select("id").eq("member_id", maya.memberId).single(),
    admin().from("doctors").select("id").eq("member_id", ravi.memberId).single(),
  ]);
  const owner = clinic.owner.tenant.supabase;
  const addPatient = async (name: string, phone = "+919876543210") => {
    const { data, error } = await owner
      .rpc("create_patient", {
        p_patient: { full_name: name, phone, date_of_birth: "1990-04-12", gender: "FEMALE" },
        p_idempotency_key: randomUUID(),
      })
      .single<{ patient_id: string }>();
    if (error) throw error;
    return data.patient_id;
  };
  const aTreatment = async (patientId: string, doctorId: string, name: string, nextDueOn: string | null) => {
    const { data, error } = await owner.rpc("create_treatment", {
      p_treatment: { patient_id: patientId, doctor_id: doctorId, name, status: "IN_PROGRESS", next_due_on: nextDueOn },
      p_visit_id: null,
    });
    if (error) throw error;
    return (data as { treatment_id: string }).treatment_id;
  };
  /** A visit some days ago, done, with its follow-up day — as the visit screen leaves one. */
  const aPastVisit = async (patientId: string, daysAgo: number, followUpOn: string) => {
    const at = new Date(Date.now() - daysAgo * DAY).toISOString();
    const { error } = await admin().from("visits").insert({
      clinic_id: clinic.clinicId,
      patient_id: patientId,
      doctor_id: mayaDoctor!.id,
      started_at: at,
      created_at: at,
      status: "COMPLETED",
      completed_at: at,
      billing_status: "TO_BILL",
      follow_up_on: followUpOn,
    });
    if (error) throw error;
  };

  const [anita, rohan, kiran, meena, divya] = await Promise.all([
    addPatient("Anita Rao"),
    addPatient("Rohan Mehta", "+919811122233"),
    addPatient("Kiran Shah"),
    addPatient("Meena Gupta"),
    addPatient("Divya Nair"),
  ]);
  await Promise.all([
    aTreatment(anita, mayaDoctor!.id, "Root canal", today),
    aTreatment(kiran, raviDoctor!.id, "Crown", addDaysKey(today, 3)),
    aPastVisit(rohan, 10, addDaysKey(today, -4)),
    aPastVisit(meena, 60, addDaysKey(today, -40)),
    (async () => {
      const done = await aTreatment(divya, mayaDoctor!.id, "Scaling", null);
      const { error } = await owner.rpc("change_treatment_status", {
        p_treatment_id: done,
        p_status: "COMPLETED",
        p_seen: "IN_PROGRESS",
      });
      if (error) throw error;
    })(),
  ]);
  return { ravi, desk, reader };
}

test("the front desk reminds, marks contacted and books the follow-ups, tab by tab", async ({ page }) => {
  const { desk } = await aClinic();
  await signIn(page, desk.email, desk.password);

  // Every tab with how many it holds (D267, D270).
  await page.goto("/follow-ups");
  await expect(page.getByRole("heading", { name: UI_TEXT.nav.places.followUps, level: 1 })).toBeVisible();
  await expect(tab(page, "Today", 1)).toHaveAttribute("aria-selected", "true");
  for (const name of ["Overdue", "Upcoming", "Lapsed", "Completed"]) await expect(tab(page, name, 1)).toBeVisible();
  const list = page.getByRole("tabpanel");
  const anita = list.getByRole("listitem").filter({ hasText: "Anita Rao" });
  await expect(anita).toContainText(words.about("Root canal", "Maya Rao"));
  await expect(anita).toContainText(UI_TEXT.treatments.dueToday);
  await expect(anita.getByRole("link", { name: patients.call("Anita Rao") })).toHaveAttribute(
    "href",
    "tel:+919876543210",
  );
  await fitsTheScreen(page);
  await expectAccessible(page);

  // Her sheet: what is due, with whom, and not yet contacted (D272, D275).
  await anita.getByRole("button", { name: "Anita Rao" }).click();
  const sheet = page.getByRole("dialog", { name: "Anita Rao" });
  await expect(sheet).toContainText(new RegExp(`P-\\d+ · ${UI_TEXT.treatments.dueToday}`));
  await expect(sheet).toContainText(formatLongDate(today));
  await expect(sheet).toContainText(words.notContacted);
  await fitsTheScreen(page);
  await expectAccessible(page);

  // Remind on WhatsApp: the message written, and noted as Reminder sent, by the desk (D273, D275).
  await page.context().route("https://wa.me/**", (route) => route.fulfill({ body: "WhatsApp" }));
  const remind = sheet.getByRole("link", { name: appointment.remindNamed("Anita Rao") });
  const message = "Dr. Maya Rao at Smile Care asked to see you again around ";
  await expect(remind).toHaveAttribute(
    "href",
    `https://wa.me/919876543210?text=${encodeURIComponent(`${message}${formatDayMonth(today)}. Reply or call 0484 234 5678 to book.`)}`,
  );
  const [chat] = await Promise.all([page.waitForEvent("popup"), remind.click()]);
  await chat.close();
  await expect(sheet).toContainText(words.lastContactBy("Reminder sent", formatDayMonth(today), "Priya Shah"));

  // Mark contacted: No answer, a note, back in 3 days — off the lists and the counts till then (D271, D274).
  const mark = sheet.getByRole("region", { name: words.markTitle });
  await mark.getByRole("button", { name: words.save }).click();
  await expect(mark).toContainText(VALIDATION_MESSAGES.choose(words.outcomeLabel));
  await mark.getByRole("radio", { name: "No answer" }).click();
  await mark.getByRole("textbox", { name: new RegExp(`^${words.noteLabel}`) }).fill("Line busy");
  await mark.getByRole("radio", { name: words.remindMeChoices["3_DAYS"] }).click();
  await expectAccessible(page);
  await mark.getByRole("button", { name: words.save }).click();
  await expect(sheet).toBeHidden();
  await expect(
    notice(page, words.notedUntil("Anita Rao", "No answer", formatDayMonth(addDaysKey(today, 3)))),
  ).toBeVisible();
  await expect(tab(page, "Today", 0)).toBeVisible();
  await expect(list).toContainText(words.empty.TODAY);

  // Overdue: Rohan's review, four days gone.
  await tab(page, "Overdue", 1).click();
  const rohan = list.getByRole("listitem").filter({ hasText: "Rohan Mehta" });
  await expect(rohan).toContainText(words.about(words.visitFollowUp, "Maya Rao"));
  await expect(rohan).toContainText(UI_TEXT.treatments.overdueBy(4));

  // Upcoming: Kiran's crown, booked from his sheet — his follow-up done, the row gone (D268, D276).
  await tab(page, "Upcoming", 1).click();
  const kiran = list.getByRole("listitem").filter({ hasText: "Kiran Shah" });
  await expect(kiran).toContainText(UI_TEXT.treatments.dueIn(3));
  await kiran.getByRole("button", { name: "Kiran Shah" }).click();
  const kiranSheet = page.getByRole("dialog", { name: "Kiran Shah" });
  await kiranSheet.getByRole("button", { name: words.bookFor("Kiran Shah") }).click();
  const book = page.getByRole("dialog", { name: appointments.bookTitle });
  await expect(book.getByRole("list", { name: appointments.patientLabel })).toContainText("Kiran Shah");
  await expect(book.getByRole("combobox", { name: /^Doctor/ })).toHaveText("Ravi Iyer");
  await expect(book.getByRole("button", { name: /^Date/ })).toContainText(formatDayMonth(addDaysKey(today, 3)));
  await book.getByRole("combobox", { name: `${appointments.timeLabel}, ${appointments.hourLabel}` }).click();
  await page.getByRole("option", { name: "10 AM" }).click();
  await book.getByRole("combobox", { name: `${appointments.timeLabel}, ${appointments.minuteLabel}` }).click();
  await page.getByRole("option", { name: ":00" }).click();
  await book.getByRole("button", { name: appointments.book }).click();
  await expect(book).toBeHidden();
  await expect(kiranSheet).toBeHidden();
  await expect(tab(page, "Upcoming", 0)).toBeVisible();
  await expect(list).toContainText(words.empty.UPCOMING);

  // Lapsed, then Completed: Divya's scaling, with only Call and her profile (D277).
  await tab(page, "Lapsed", 1).click();
  await expect(list.getByRole("listitem").filter({ hasText: "Meena Gupta" })).toContainText(
    UI_TEXT.treatments.overdueBy(40),
  );
  await tab(page, "Completed", 1).click();
  const divya = list.getByRole("listitem").filter({ hasText: "Divya Nair" });
  await expect(divya).toContainText(UI_TEXT.treatments.completedOn(formatDayMonth(today)));
  await divya.getByRole("button", { name: "Divya Nair" }).click();
  const done = page.getByRole("dialog", { name: "Divya Nair" });
  await expect(done.getByRole("link", { name: patients.call("Divya Nair") })).toBeVisible();
  await expect(done.getByRole("link", { name: appointment.openProfileOf("Divya Nair") })).toBeVisible();
  await expect(done.getByRole("link", { name: appointment.remindNamed("Divya Nair") })).toHaveCount(0);
  await expect(done.getByRole("button", { name: words.bookFor("Divya Nair") })).toHaveCount(0);
  await expect(done.getByRole("region", { name: words.markTitle })).toHaveCount(0);
  await expectAccessible(page);
  await done.getByRole("link", { name: appointment.openProfileOf("Divya Nair") }).click();
  await expect(page.getByRole("heading", { name: "Divya Nair", level: 1 })).toBeVisible();
});

test("a doctor sees only their own patients'; one who only reads reminds without noting, and books nothing", async ({
  page,
}) => {
  const { ravi, reader } = await aClinic();

  await signIn(page, ravi.email, ravi.password);
  await page.goto("/follow-ups");
  await expect(page.getByText(words.yours)).toBeVisible();
  await expect(tab(page, "Today", 0)).toBeVisible();
  await expect(tab(page, "Upcoming", 1)).toBeVisible();
  await expect(tab(page, "Overdue", 0)).toBeVisible();
  await expectAccessible(page);

  await page.context().clearCookies();
  await signIn(page, reader.email, reader.password);
  await page.goto("/follow-ups");
  await page.getByRole("tabpanel").getByRole("button", { name: "Anita Rao" }).click();
  const sheet = page.getByRole("dialog", { name: "Anita Rao" });
  await expect(sheet.getByRole("link", { name: appointment.remindNamed("Anita Rao") })).toBeVisible();
  await expect(sheet.getByRole("button", { name: words.bookFor("Anita Rao") })).toHaveCount(0);
  await expect(sheet.getByRole("region", { name: words.markTitle })).toHaveCount(0);
  await page.context().route("https://wa.me/**", (route) => route.fulfill({ body: "WhatsApp" }));
  const [chat] = await Promise.all([
    page.waitForEvent("popup"),
    sheet.getByRole("link", { name: appointment.remindNamed("Anita Rao") }).click(),
  ]);
  await chat.close();
  await expect(sheet).toContainText(words.notContacted);
  await expectAccessible(page);
});
