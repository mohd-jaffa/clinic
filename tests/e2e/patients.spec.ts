import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { PERMISSION_PRESET_SETS } from "@/constants/permissions";
import { createPatient } from "@/features/patients/api";
import { todayKey } from "@/lib/dates/calendar";
import { formatDate, formatLongDate } from "@/lib/format/date";
import type { Tenant } from "@/lib/supabase/tenant";
import { patientSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, aMobileNumber, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Adding a patient (plan §10.1; R4.2, D105 – D109): a receptionist starts
 * from the ＋, finds the family already on the mobile typed, adds a brother
 * by his age, and lands on his profile with his number — Back leads to the
 * list, not the form. The owner gives a date of birth decades back through
 * the calendar's year and month jump.
 *
 * The list (plan §10.2; R4.3, D104, D110 – D112): a receptionist pages
 * through the clinic's patients, finds one by name, mobile and number, adds
 * someone a search did not find with what was typed, and opens the
 * archived; a doctor finds only their own. A tab shows its own patients, or
 * loading rows while they come, never the last tab's (D191).
 *
 * The profile (plan §10.3; R4.4, D113 – D116): a receptionist opens a
 * patient from the list, reads what their details hold, reaches them by
 * Call or WhatsApp, and changes their email; a doctor cannot open another
 * doctor's patient.
 *
 * Alerts (plan §10.4; R4.5, D117 – D120): a doctor records an allergy and a
 * condition from the profile's alerts sheet, adds a note later, and turns
 * one off after confirming; the header shows what is active, allergies
 * first. A receptionist, who may not read visits, sees none.
 *
 * Archive and restore (plan §10.1; R4.6, D122 – D125): a receptionist
 * archives a patient from the foot of their edit sheet after confirming,
 * stays on the profile, which says when and by whom; finds them under
 * Archived, not on the list; and restores them at once. While she has an
 * open treatment the archive is refused, the card saying so without naming
 * it to someone who reads no treatments (R7.1, D255). At a phone's width and
 * a desktop's, each checked by axe.
 */
test.afterAll(removeAll);

const { patients, quickActions, datePicker } = UI_TEXT;

/** The doctor's row a member's profile hangs from. */
async function doctorOf(memberId: string) {
  const { data } = await admin().from("doctors").select("id").eq("member_id", memberId).single();
  return data!.id as string;
}

/** Patients added at once, as an import does, numbered from 1001 in the order given. */
async function imported(tenant: Tenant, people: { name: string; phone?: string }[]) {
  const rows = people.map(({ name, phone }) => ({
    full_name: name,
    phone: phone ?? `+91${aMobileNumber()}`,
    date_of_birth: "1990-04-12",
    gender: "FEMALE",
    idempotency_key: randomUUID(),
  }));
  const { error } = await tenant.supabase.rpc("import_patients", { p_patients: rows });
  expect(error).toBeNull();
}

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

/** The patient the profile's address names, as the database holds them. */
async function added(page: Page) {
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").pop();
  const { data } = await admin()
    .from("patients")
    .select("full_name, patient_number, date_of_birth, dob_is_estimated, gender")
    .eq("id", id!)
    .single();
  return data;
}

test("a receptionist adds a brother to a family already on file, from the ＋", async ({ page }) => {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const receptionist = await addMember(clinic.clinicId, {
    permissions: [...PERMISSION_PRESET_SETS.RECEPTIONIST.permissions],
  });
  const mobile = aMobileNumber();
  for (const [fullName, date] of [
    ["Anita Mehta", "1991-06-14"],
    ["Riya Mehta", "2020-02-03"],
  ]) {
    const typed = { fullName, phone: mobile, born: { as: "DATE", date }, gender: "FEMALE" };
    await createPatient(clinic.owner.tenant, patientSchema.parse(typed), randomUUID());
  }
  await signIn(page, receptionist.email, receptionist.password);

  await page.goto("/home");
  await page.getByRole("button", { name: quickActions.title }).click();
  await page
    .getByRole("dialog", { name: quickActions.title })
    .getByRole("link", { name: quickActions.patient })
    .click();
  await expect(page).toHaveURL(/\/patients\?add=patient$/);
  const sheet = page.getByRole("dialog", { name: patients.addTitle });
  await expect(sheet).toBeVisible();
  await expectAccessible(page);

  await sheet.getByRole("textbox", { name: /^Full name/ }).fill("Kabir Mehta");
  await sheet.getByRole("textbox", { name: /^Mobile/ }).fill(mobile);
  const family = sheet.getByRole("region", { name: patients.matchesTitle(2) });
  await expect(family.getByRole("link")).toHaveText([/^Riya Mehta/, /^Anita Mehta/]);
  await expectAccessible(page);

  await sheet.getByRole("radio", { name: patients.bornAs.AGE }).click();
  await sheet.getByRole("textbox", { name: /^Age in years/ }).fill("9");
  await sheet.getByRole("radio", { name: "Male", exact: true }).click();
  await sheet.getByRole("button", { name: patients.add }).click();

  expect(await added(page)).toMatchObject({
    full_name: "Kabir Mehta",
    patient_number: 1003,
    dob_is_estimated: true,
    gender: "MALE",
  });
  await expect(page.getByRole("heading", { level: 1, name: "Kabir Mehta" })).toBeVisible();
  await expect(page.getByText("9 y · Male · P-1003")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/home$/);
});

test("the owner gives a date of birth decades back through the calendar's jump (D109)", async ({ page }) => {
  const { owner } = await registerClinic({ fullName: "Asha Menon" });
  await signIn(page, owner.email, owner.password);

  await page.goto("/patients");
  await page.getByRole("button", { name: patients.add }).click();
  await expect(page).toHaveURL(/\/patients\?add=patient$/);
  const sheet = page.getByRole("dialog", { name: patients.addTitle });
  await sheet.getByRole("textbox", { name: /^Full name/ }).fill("Leela George");
  await sheet.getByRole("textbox", { name: /^Mobile/ }).fill(aMobileNumber());

  await sheet.getByRole("button", { name: /^Date of birth/ }).click();
  const calendar = page.getByRole("dialog", { name: datePicker.calendar(patients.dateOfBirthLabel) });
  await calendar.getByRole("button", { name: /choose another month/ }).click();
  await calendar.getByRole("button", { name: /choose another year/ }).click();
  await expectAccessible(page);
  for (let page_ = 0; page_ < 3; page_ += 1)
    await calendar.getByRole("button", { name: datePicker.earlierYears }).click();
  await calendar.getByRole("button", { name: "1985" }).click();
  await calendar.getByRole("button", { name: "April 1985" }).click();
  await calendar.getByRole("button", { name: formatLongDate("1985-04-12") }).click();
  await expect(sheet.getByRole("button", { name: /^Date of birth/ })).toContainText("12 Apr 1985");

  await sheet.getByRole("radio", { name: "Female" }).click();
  await sheet.getByRole("button", { name: patients.add }).click();
  expect(await added(page)).toEqual({
    full_name: "Leela George",
    patient_number: 1001,
    date_of_birth: "1985-04-12",
    dob_is_estimated: false,
    gender: "FEMALE",
  });
  await expect(page.getByRole("definition").filter({ hasText: "12 Apr 1985" })).toBeVisible();
  // The add form is gone from where Back leads.
  await page.goBack();
  await expect(page).toHaveURL(/\/patients$/);
  await expect(page.getByRole("dialog", { name: patients.addTitle })).toBeHidden();
});

test("a receptionist finds patients by name, mobile and number, and adds one not found", async ({ page }) => {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const receptionist = await addMember(clinic.clinicId, {
    permissions: [...PERMISSION_PRESET_SETS.RECEPTIONIST.permissions],
  });
  // Kabir is the first added, so the last listed: past the first page.
  await imported(clinic.owner.tenant, [
    { name: "Kabir Mehta", phone: "+919876501234" },
    ...Array.from({ length: 21 }, (_, index) => ({ name: `Walk-in ${String(index + 2).padStart(2, "0")}` })),
  ]);
  const { data: archived } = await admin()
    .from("patients")
    .select("id")
    .eq("clinic_id", clinic.clinicId)
    .eq("full_name", "Walk-in 02")
    .single();
  await clinic.owner.tenant.supabase
    .from("patients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", archived!.id);
  await signIn(page, receptionist.email, receptionist.password);

  await page.goto("/patients");
  const list = page.getByRole("list", { name: UI_TEXT.nav.places.patients });
  await expect(list.getByRole("listitem")).toHaveCount(20);
  await expect(list.getByRole("listitem").first()).toContainText("Walk-in 22");
  await expectAccessible(page);
  await page.getByRole("button", { name: UI_TEXT.actions.showMore }).click();
  await expect(list.getByRole("listitem")).toHaveCount(21);
  await expect(list.getByRole("listitem").last()).toContainText("Kabir Mehta");
  await expect(page.getByRole("button", { name: UI_TEXT.actions.showMore })).toBeHidden();

  const search = page.getByRole("searchbox", { name: patients.searchPlaceholder });
  for (const typed of ["kabir", "98765 01234", "P-1001"]) {
    await search.fill(typed);
    await expect(list.getByRole("listitem").first()).toContainText("Kabir Mehta");
  }
  await expect(list.getByRole("listitem").first()).toContainText("98765 01234");
  await expectAccessible(page);

  await search.fill("Zoya Khan");
  await expect(page.getByText(patients.noMatches("Zoya Khan"))).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: patients.add }).last().click();
  const sheet = page.getByRole("dialog", { name: patients.addTitle });
  await expect(sheet.getByRole("textbox", { name: /^Full name/ })).toHaveValue("Zoya Khan");
  await sheet.getByRole("button", { name: UI_TEXT.actions.close }).click();
  await expect(sheet).toBeHidden();

  await search.fill("");
  await page.getByRole("tab", { name: patients.tabs.ARCHIVED }).click();
  const shelf = page.getByRole("tabpanel");
  await expect(shelf.getByRole("listitem")).toHaveCount(1);
  await expect(shelf.getByRole("listitem")).toContainText("Walk-in 02");
  await expectAccessible(page);
});

test("a tab shows its own patients, never the last tab's on the way (D191)", async ({ page }) => {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  await imported(clinic.owner.tenant, [{ name: "Ravi Kumar" }, { name: "Lakshmi Rao" }]);
  await clinic.owner.tenant.supabase
    .from("patients")
    .update({ archived_at: new Date().toISOString() })
    .eq("clinic_id", clinic.clinicId)
    .eq("full_name", "Lakshmi Rao");
  await signIn(page, clinic.owner.email, clinic.owner.password);

  await page.goto("/patients");
  const shelf = page.getByRole("tabpanel");
  await expect(shelf.getByRole("link", { name: /^Ravi Kumar/ })).toBeVisible();

  // The archived are held back, so the tab can be looked at while they come.
  let letGo!: () => void;
  const held = new Promise<void>((settle) => (letGo = settle));
  await page.route("**/api/patients/search", async (route) => {
    if (route.request().postDataJSON()?.tab === "ARCHIVED") await held;
    await route.continue();
  });
  const archived = page.getByRole("tab", { name: patients.tabs.ARCHIVED });
  await archived.click();
  await expect(archived).toHaveAttribute("aria-selected", "true");
  expect(await shelf.getByRole("link", { name: /^Ravi Kumar/ }).count()).toBe(0);
  await expectAccessible(page);

  letGo();
  await expect(shelf.getByRole("link", { name: /^Lakshmi Rao/ })).toBeVisible();
  await expect(shelf.getByRole("link", { name: /^Ravi Kumar/ })).toBeHidden();
});

test("a doctor finds only their own patients (D3)", async ({ page }) => {
  const clinic = await registerClinic({ fullName: "Asha Menon" });
  const doctor = await addMember(clinic.clinicId, {
    role: "DOCTOR",
    permissions: [...PERMISSION_PRESET_SETS.DOCTOR.permissions],
  });
  const theirs = await doctorOf(doctor.memberId);
  for (const [fullName, assignedDoctorId] of [
    ["Meena Iyer", theirs],
    ["Someone Else", ""],
  ]) {
    const typed = { fullName, phone: aMobileNumber(), born: { as: "AGE", years: "41" }, gender: "FEMALE" };
    await createPatient(clinic.owner.tenant, patientSchema.parse({ ...typed, assignedDoctorId }), randomUUID());
  }
  await signIn(page, doctor.email, doctor.password);

  await page.goto("/patients");
  await expect(page.getByText(patients.yours)).toBeVisible();
  const list = page.getByRole("list", { name: UI_TEXT.nav.places.patients });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list.getByRole("listitem")).toContainText("Meena Iyer");
  await page.getByRole("searchbox", { name: patients.searchPlaceholder }).fill("Someone");
  await expect(page.getByText(patients.noMatches("Someone"))).toBeVisible();
  await expectAccessible(page);
});

test("a receptionist opens a patient's profile from the list and changes their details", async ({ page }) => {
  const clinic = await registerClinic({ fullName: "Asha Menon" });
  const receptionist = await addMember(clinic.clinicId, {
    permissions: [...PERMISSION_PRESET_SETS.RECEPTIONIST.permissions],
  });
  const typed = {
    fullName: "Meena Iyer",
    phone: "99000 11223",
    born: { as: "DATE", date: "1985-04-12" },
    gender: "FEMALE",
    address: "Flat 4B, Lotus Residency\n12 MG Road, Kochi",
    emergencyContactName: "Ravi Iyer",
    notes: "Prefers mornings",
  };
  await createPatient(clinic.owner.tenant, patientSchema.parse(typed), randomUUID());
  await signIn(page, receptionist.email, receptionist.password);

  await page.goto("/patients");
  await page.getByRole("link", { name: /^Meena Iyer/ }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Meena Iyer" })).toBeVisible();
  await expect(page.getByRole("paragraph").filter({ hasText: patients.noDoctor })).toBeVisible();
  await expect(page.getByRole("link", { name: patients.call("Meena Iyer") })).toHaveAttribute(
    "href",
    "tel:+919900011223",
  );
  await expect(page.getByRole("link", { name: patients.whatsAppTo("Meena Iyer") })).toHaveAttribute(
    "href",
    "https://wa.me/919900011223",
  );
  await expect(page.getByRole("term")).toHaveText([
    patients.mobileLabel,
    patients.dateOfBirthLabel,
    patients.addressLabel,
    patients.emergencyNameLabel,
    patients.notesLabel,
  ]);
  await expectAccessible(page);

  await page.getByRole("button", { name: patients.editName("Meena Iyer") }).click();
  const sheet = page.getByRole("dialog", { name: patients.editTitle });
  await sheet.getByRole("textbox", { name: /^Email/ }).fill("meena@mail.in");
  await expectAccessible(page);
  await sheet.getByRole("button", { name: UI_TEXT.actions.save }).click();
  await expect(page.getByRole("status").filter({ hasText: patients.saved("Meena Iyer") })).toBeVisible();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("definition").filter({ hasText: "meena@mail.in" })).toBeVisible();
});

test("a doctor cannot open another doctor's patient (D3)", async ({ page }) => {
  const clinic = await registerClinic({ fullName: "Asha Menon" });
  const doctor = await addMember(clinic.clinicId, {
    role: "DOCTOR",
    permissions: [...PERMISSION_PRESET_SETS.DOCTOR.permissions],
  });
  const typed = { fullName: "Someone Else", phone: aMobileNumber(), born: { as: "AGE", years: "41" }, gender: "MALE" };
  const theirs = await createPatient(clinic.owner.tenant, patientSchema.parse(typed), randomUUID());
  await signIn(page, doctor.email, doctor.password);

  await page.goto(`/patients/${theirs.id}`);
  await expect(page.getByRole("alert").filter({ hasText: "That record could not be found." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Someone Else" })).toBeHidden();
  await expectAccessible(page);
});

test("a doctor records a patient's alerts, changes one and turns one off (D117 – D120)", async ({ page }) => {
  const clinic = await registerClinic({ fullName: "Asha Menon" });
  const doctor = await addMember(clinic.clinicId, {
    role: "DOCTOR",
    permissions: [...PERMISSION_PRESET_SETS.DOCTOR.permissions],
  });
  const receptionist = await addMember(clinic.clinicId, {
    permissions: [...PERMISSION_PRESET_SETS.RECEPTIONIST.permissions],
  });
  const typed = { fullName: "Meena Iyer", phone: aMobileNumber(), born: { as: "AGE", years: "41" }, gender: "FEMALE" };
  const meena = await createPatient(
    clinic.owner.tenant,
    patientSchema.parse({ ...typed, assignedDoctorId: await doctorOf(doctor.memberId) }),
    randomUUID(),
  );
  await signIn(page, doctor.email, doctor.password);

  await page.goto(`/patients/${meena.id}`);
  await expect(page.getByText(UI_TEXT.alerts.none, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: UI_TEXT.alerts.open }).click();
  const alerts = page.getByRole("dialog", { name: UI_TEXT.alerts.title });
  await expect(alerts.getByRole("heading", { name: UI_TEXT.alerts.emptyTitle })).toBeVisible();
  await expectAccessible(page);

  for (const [kind, label] of [
    ["Condition", "Type 2 diabetes"],
    ["Allergy", "Penicillin"],
  ]) {
    await alerts.getByRole("button", { name: UI_TEXT.alerts.add }).click();
    const add = page.getByRole("dialog", { name: UI_TEXT.alerts.addTitle });
    await add.getByRole("radio", { name: kind }).click();
    await add.getByRole("textbox", { name: /^Name/ }).fill(label);
    if (label === "Penicillin") await expectAccessible(page);
    await add.getByRole("button", { name: UI_TEXT.alerts.add }).click();
    await expect(page.getByRole("status").filter({ hasText: UI_TEXT.alerts.added(label) })).toBeVisible();
    await expect(add).toBeHidden();
  }

  await alerts.getByRole("button", { name: UI_TEXT.alerts.edit("Penicillin") }).click();
  const edit = page.getByRole("dialog", { name: UI_TEXT.alerts.editTitle("Allergy") });
  await edit.getByRole("textbox", { name: /^Note/ }).fill("Rash and swelling, 2019");
  await edit.getByRole("button", { name: UI_TEXT.actions.save }).click();
  await expect(alerts.getByText("Allergy · Rash and swelling, 2019")).toBeVisible();

  await alerts.getByRole("button", { name: UI_TEXT.alerts.turnOffName("Type 2 diabetes") }).click();
  const ask = page.getByRole("alertdialog", { name: UI_TEXT.alerts.turnOffTitle("Type 2 diabetes") });
  await expectAccessible(page);
  await ask.getByRole("button", { name: UI_TEXT.alerts.turnOff }).click();
  await expect(page.getByRole("status").filter({ hasText: UI_TEXT.alerts.turnedOff("Type 2 diabetes") })).toBeVisible();
  // The notice sits over the sheet's foot; closed, as a person would, rather than waited out.
  await page
    .getByRole("button", { name: UI_TEXT.response.closeNotice(UI_TEXT.alerts.turnedOff("Type 2 diabetes")) })
    .click();
  await alerts.getByRole("button", { name: UI_TEXT.alerts.showTurnedOff(1) }).click();
  await expect(alerts.getByRole("list", { name: UI_TEXT.alerts.turnedOffSection })).toContainText("Type 2 diabetes");
  await alerts.getByRole("button", { name: UI_TEXT.actions.close, exact: true }).click();

  await expect(page.getByRole("list", { name: UI_TEXT.alerts.title }).getByRole("listitem")).toHaveText([
    "Allergy: Penicillin",
  ]);
  await expectAccessible(page);

  // Someone who may not read visits sees no alerts at all.
  await page.context().clearCookies();
  await signIn(page, receptionist.email, receptionist.password);
  await page.goto(`/patients/${meena.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Meena Iyer" })).toBeVisible();
  await expect(page.getByRole("button", { name: UI_TEXT.alerts.open })).toBeHidden();
  await expect(page.getByText("Penicillin")).toBeHidden();
});

test("a receptionist archives a patient, finds them under Archived and restores them (D122 – D125)", async ({
  page,
}) => {
  const clinic = await registerClinic({ fullName: "Asha Menon" });
  const receptionist = await addMember(clinic.clinicId, {
    permissions: [...PERMISSION_PRESET_SETS.RECEPTIONIST.permissions],
  });
  const typed = { fullName: "Meena Iyer", phone: aMobileNumber(), born: { as: "AGE", years: "41" }, gender: "FEMALE" };
  const meena = await createPatient(clinic.owner.tenant, patientSchema.parse(typed), randomUUID());
  await signIn(page, receptionist.email, receptionist.password);

  // An open treatment holds her back (D255).
  const { data: doctor } = await admin()
    .from("doctors")
    .select("id")
    .eq("member_id", clinic.owner.session.membership!.id)
    .single();
  const { data: treatment } = await admin()
    .from("treatments")
    .insert({ clinic_id: clinic.clinicId, patient_id: meena.id, doctor_id: doctor!.id, name: "Root canal" })
    .select("id")
    .single();

  await page.goto(`/patients/${meena.id}`);
  await page.getByRole("button", { name: patients.editName("Meena Iyer") }).click();
  const sheet = page.getByRole("dialog", { name: patients.editTitle });
  const ask = page.getByRole("alertdialog", { name: patients.archiveTitle("Meena Iyer") });
  await sheet.getByRole("button", { name: UI_TEXT.actions.archive }).click();
  await ask.getByRole("button", { name: UI_TEXT.actions.archive }).click();
  // The receptionist reads no treatments: told only that there is one.
  const refused = page.getByRole("alertdialog", { name: patients.hasOpenTreatment("Meena Iyer", null) });
  await expect(refused).toContainText(ERROR_MESSAGES.PATIENT_HAS_TREATMENTS);
  await expectAccessible(page);
  await refused.getByRole("button", { name: UI_TEXT.actions.close }).click();
  await admin().from("treatments").update({ status: "CANCELLED" }).eq("id", treatment!.id);

  // Cancelled, it no longer does.
  await sheet.getByRole("button", { name: UI_TEXT.actions.archive }).click();
  await expect(ask).toContainText(patients.archiveBody);
  await expectAccessible(page);
  await ask.getByRole("button", { name: UI_TEXT.actions.archive }).click();
  await expect(page.getByRole("status").filter({ hasText: patients.archivedNote("Meena Iyer") })).toBeVisible();
  await expect(sheet).toBeHidden();

  // The profile stays, read-only, saying when and by whom (D123, D124).
  await expect(page).toHaveURL(new RegExp(`/patients/${meena.id}$`));
  await expect(page.getByText(patients.archivedOn(formatDate(todayKey()), "Test staff"))).toBeVisible();
  await expect(page.getByText(patients.archivedHint)).toBeVisible();
  await expect(page.getByRole("button", { name: patients.editName("Meena Iyer") })).toBeHidden();
  await expectAccessible(page);

  await page.getByRole("link", { name: UI_TEXT.actions.back }).click();
  await expect(page.getByRole("heading", { name: patients.emptyTitle })).toBeVisible();
  await page.getByRole("tab", { name: patients.tabs.ARCHIVED }).click();
  await page
    .getByRole("tabpanel")
    .getByRole("link", { name: /^Meena Iyer/ })
    .click();

  // Restore asks nothing (D125); the profile can be changed again.
  await page.getByRole("button", { name: patients.restoreName("Meena Iyer") }).click();
  await expect(page.getByRole("status").filter({ hasText: patients.restoredNote("Meena Iyer") })).toBeVisible();
  await expect(page.getByText(patients.archivedHint)).toBeHidden();
  await expect(page.getByRole("button", { name: patients.editName("Meena Iyer") })).toBeVisible();
  await expectAccessible(page);
});
