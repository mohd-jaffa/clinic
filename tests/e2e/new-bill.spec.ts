import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { walkInSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * A new bill (plan §15.2, §11.3; R8.3, D302 – D313), at a phone's width and a
 * desktop's. The owner bills Anita's visit from **Bill now**: the
 * consultation at Dr. Maya Rao's fee, Root canal by its treatment, and a
 * reminder for the crown, which Issue refuses until its entry is picked; the
 * whole collected by UPI, and back to the visit with the card. Reception —
 * who may not open a visit — bills Kiran's visit from his profile's New
 * bill, and Sunil, searched for first, from the price list. With the fee
 * taken at arrival, Arrived opens Collect fee after the token, and the queue
 * says Fee paid; a fee skipped is collected from the patient's detail. Each
 * screen checked by axe, nothing wider than the screen.
 */
test.afterAll(removeAll);

const { billing: words, queue, patients } = UI_TEXT;
const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit"];
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
const figure = (page: Page, label: string) =>
  page
    .locator("dt")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("+ dd");
/** The first bill of the financial year, whichever year the suite runs in. */
const firstIssued = /^Bill \d{4}-\d{2}\/0001 issued/;
const secondIssued = /^Bill \d{4}-\d{2}\/0002 issued/;

/** Now on the clinic's 5-minute steps: today's, whatever the hour the suite runs at. */
const stepNow = () => new Date(Math.floor(Date.now() / 300_000) * 300_000).toISOString();

/**
 * Smile Care: Dr. Maya Rao at ₹800 a consultation, a front desk, and a price
 * list of Consultation (₹500), Root canal and Zirconia crown.
 */
async function aClinic() {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const [maya, desk] = await Promise.all([
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
    addMember(clinic.clinicId, { permissions: DESK }),
  ]);
  await Promise.all([
    admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId),
    admin().from("doctors").update({ consultation_fee_paise: 80_000 }).eq("member_id", maya.memberId),
    admin()
      .from("services")
      .update({ price_paise: 50_000 })
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation"),
    admin()
      .from("services")
      .insert([
        { clinic_id: clinic.clinicId, name: "Root canal", category: "PROCEDURE", price_paise: 450_000 },
        { clinic_id: clinic.clinicId, name: "Zirconia crown", category: "PROCEDURE", price_paise: 800_000 },
      ]),
  ]);
  const [{ data: doctors }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id, member_id").eq("clinic_id", clinic.clinicId),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  const doctor = doctors!.find((row) => row.member_id === maya.memberId)!;
  /** Asha Menon, the owner, a doctor with no fee of her own. */
  const owner = doctors!.find((row) => row.member_id !== maya.memberId)!;
  const addPatient = async (name: string) => {
    const { data, error } = await desk
      .tenant!.supabase.rpc("create_patient", {
        p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "FEMALE" },
        p_idempotency_key: randomUUID(),
      })
      .single<{ patient_id: string }>();
    if (error) throw error;
    return data.patient_id;
  };
  /** A visit with Dr. Maya Rao, done: walked in, sent in, its treatments worked on, and marked done. */
  const doneVisit = async (patientId: string, treatments: string[] = []) => {
    const arrival = await addWalkIn(
      desk.tenant!,
      walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId: doctor!.id, typeId: type!.id }),
      randomUUID(),
    );
    const { visitId } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
    for (const name of treatments) {
      const { error } = await maya.tenant!.supabase.rpc("create_treatment", {
        p_treatment: { name, status: "IN_PROGRESS" },
        p_visit_id: visitId,
      });
      expect(error).toBeNull();
    }
    await markDone(desk.tenant!, { appointmentId: arrival.id });
    return visitId;
  };
  /** Booked for now — today, whatever the hour — with Dr. Maya Rao, or the owner. */
  const bookNow = async (patientId: string, withOwner = false) => {
    const { error } = await admin()
      .from("appointments")
      .insert({
        clinic_id: clinic.clinicId,
        patient_id: patientId,
        doctor_id: (withOwner ? owner : doctor).id,
        source: "BOOKED",
        appointment_type_id: type!.id,
        scheduled_at: stepNow(),
        duration_minutes: 15,
      });
    expect(error).toBeNull();
  };
  return { clinic, desk, addPatient, doneVisit, bookNow };
}

test("the owner bills a visit from Bill now, its unpriced treatment picked, collected in full", async ({ page }) => {
  const { clinic, addPatient, doneVisit } = await aClinic();
  const anita = await addPatient("Anita Rao");
  const visitId = await doneVisit(anita, ["Root canal", "Crown"]);
  await signIn(page, clinic.owner.email, clinic.owner.password);

  // Bill now, at the foot of the visit (D307).
  await page.goto(`/visits/${visitId}`);
  await page.getByRole("link", { name: words.billNowOf("Anita Rao") }).click();
  await expect(page).toHaveURL(new RegExp(`/billing/new\\?visit=${visitId}$`));
  const lines = page.getByRole("region", { name: words.linesTitle });
  // The consultation at the doctor's fee, Root canal for its treatment, a reminder for the crown (D285, D308).
  await expect(lines.getByRole("textbox", { name: words.priceOf("Consultation") })).toHaveValue("800");
  await expect(lines.getByRole("textbox", { name: words.priceOf("Root canal") })).toHaveValue("4500");
  await expect(lines).toContainText(words.forTreatment("Root canal"));
  await expect(lines).toContainText(words.pickReminder("Crown"));
  await expect(figure(page, words.total)).toHaveText("₹5,300");
  await fitsTheScreen(page);
  await expectAccessible(page);

  // Not issued until the crown has its entry (D308).
  await page.getByRole("button", { name: words.issue }).click();
  await expect(page.getByText(VALIDATION_MESSAGES.pickEntry("Crown"))).toBeVisible();
  await lines.getByRole("button", { name: words.pickEntryFor("Crown"), exact: true }).click();
  const picking = page.getByRole("dialog", { name: words.pickTitle("Crown") });
  await picking.getByRole("searchbox").fill("zirc");
  await expectAccessible(page);
  await picking.getByRole("button", { name: "Zirconia crown" }).click();
  await expect(picking).toBeHidden();
  await expect(lines).toContainText(words.forTreatment("Crown"));
  await expect(figure(page, words.total)).toHaveText("₹13,300");

  // Collected in full by UPI: the amount follows the total (D304).
  await expect(page.getByRole("textbox", { name: new RegExp(`^${words.amountLabel}`) })).toHaveValue("13300");
  await page.getByRole("radio", { name: "UPI" }).click();
  await page.getByRole("textbox", { name: new RegExp(`^${words.referenceLabel}`) }).fill("UTR 42");
  await expect(figure(page, words.balanceAfter)).toHaveText(words.settled);
  await expectAccessible(page);
  await page.getByRole("button", { name: words.issue }).click();

  // Back to the visit, with the card (D302).
  await expect(page).toHaveURL(new RegExp(`/visits/${visitId}$`));
  await expect(notice(page, firstIssued)).toContainText(words.collected("₹13,300"));
  await expectAccessible(page);
});

test("reception bills a visit from the profile, and a patient searched for from the price list", async ({ page }) => {
  const { desk, addPatient, doneVisit } = await aClinic();
  const [kiran, sunil] = await Promise.all([addPatient("Kiran Das"), addPatient("Sunil Nair")]);
  const visitId = await doneVisit(kiran);
  await signIn(page, desk.email, desk.password);

  // New bill beside New visit (D311); his visit to bill offered (D313).
  await page.goto(`/patients/${kiran}`);
  await page.getByRole("link", { name: words.newBillOf("Kiran Das") }).click();
  await expect(page).toHaveURL(new RegExp(`/billing/new\\?patient=${kiran}$`));
  await expect(page.getByText(new RegExp(`^${patients.hasVisitToBill("Kiran Das", "")}`))).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("link", { name: words.billThatVisit }).click();
  await expect(page).toHaveURL(new RegExp(`/billing/new\\?visit=${visitId}&from=patient$`));
  // Without permission to change prices, the consultation's price is its read-out (D309).
  const lines = page.getByRole("region", { name: words.linesTitle });
  await expect(lines.getByRole("textbox", { name: words.priceOf("Consultation") })).toHaveCount(0);
  await expect(figure(page, words.total)).toHaveText("₹800");
  await page.getByRole("checkbox", { name: words.collectNow }).uncheck();
  await expect(figure(page, words.balanceAfter)).toHaveText(words.due("₹800"));
  await fitsTheScreen(page);
  await expectAccessible(page);
  await page.getByRole("button", { name: words.issue }).click();
  // Back to his profile — never to a visit reception may not open (D302).
  await expect(page).toHaveURL(new RegExp(`/patients/${kiran}$`));
  await expect(notice(page, firstIssued)).toBeVisible();

  // No one named: the patient searched for first (D313), then a line from the price list (D303).
  await page.goto("/billing/new");
  await page.getByRole("searchbox").fill("Sunil");
  await page.getByRole("button", { name: "Sunil Nair" }).click();
  await expect(page).toHaveURL(new RegExp(`/billing/new\\?patient=${sunil}$`));
  await expect(page.getByText(words.noLines)).toBeVisible();
  await page.getByRole("button", { name: words.addLine }).click();
  const adding = page.getByRole("dialog", { name: words.addLineTitle });
  await expect(adding.getByRole("heading", { name: "Procedure" })).toBeVisible();
  await expect(adding.getByRole("button", { name: words.addTyped })).toHaveCount(0);
  await adding.getByRole("searchbox").fill("root");
  await expectAccessible(page);
  await adding.getByRole("button", { name: "Root canal" }).click();
  await expect(adding).toBeHidden();
  await expect(figure(page, words.total)).toHaveText("₹4,500");
  await expectAccessible(page);
  await page.getByRole("button", { name: words.issue }).click();
  await expect(page).toHaveURL(new RegExp(`/patients/${sunil}$`));
  await expect(notice(page, secondIssued)).toContainText(words.collected("₹4,500"));
});

test("with the fee at arrival, Arrived asks for it after the token, and the queue says Fee paid", async ({ page }) => {
  const { clinic, desk, addPatient, bookNow } = await aClinic();
  await admin().from("clinics").update({ fee_timing: "AT_ARRIVAL" }).eq("id", clinic.clinicId);
  const [kiran, sunil] = await Promise.all([addPatient("Kiran Das"), addPatient("Sunil Nair")]);
  await Promise.all([bookNow(kiran), bookNow(sunil, true)]);
  await signIn(page, desk.email, desk.password);

  // Arrived: the token first, then the doctor's fee (D283, D305).
  await page.goto("/queue");
  await page.getByRole("button", { name: queue.markArrived("Kiran Das") }).click();
  const fee = page.getByRole("dialog", { name: words.collectFee });
  await expect(fee).toContainText(queue.tokenGiven("Kiran Das", 1, "Maya Rao"));
  await expect(fee).toContainText("₹800");
  await expectAccessible(page);
  await fee.getByRole("button", { name: words.issueAndCollect }).click();
  await expect(fee).toBeHidden();
  await expect(notice(page, firstIssued)).toContainText(words.collected("₹800"));
  const waiting = page.getByRole("list", { name: queue.waiting });
  await expect(waiting.getByRole("listitem").filter({ hasText: "Kiran Das" })).toContainText(words.feePaid);

  // Skipped, then collected from the detail (D306): the owner's fee is the price list's.
  await page.getByRole("button", { name: queue.markArrived("Sunil Nair") }).click();
  await fee.getByRole("button", { name: words.skip }).click();
  await expect(fee).toBeHidden();
  const sunilRow = waiting.getByRole("listitem").filter({ hasText: "Sunil Nair" });
  await expect(sunilRow).not.toContainText(words.feePaid);
  await sunilRow.getByRole("button", { name: "Sunil Nair", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Sunil Nair" });
  await expectAccessible(page);
  await detail.getByRole("button", { name: words.collectFeeOf("Sunil Nair") }).click();
  await expect(fee).toContainText("₹500");
  await expect(fee).not.toContainText(" is #");
  await page.getByRole("radio", { name: "UPI" }).click();
  await fee.getByRole("button", { name: words.issueAndCollect }).click();
  await expect(notice(page, secondIssued)).toBeVisible();
  await expect(sunilRow).toContainText(words.feePaid);
  await fitsTheScreen(page);
  await expectAccessible(page);
});
