import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { savePrescription } from "@/features/prescriptions/records";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
import { formatDate } from "@/lib/format/date";
import { savePrescriptionSchema, walkInSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * A patient's history and last visit (plan §10.2, §10.3; R6.5, D225 –
 * D231), at a phone's width and a desktop's. Rohan was seen today — his
 * walk-in standing as its visit, with what it found and his medicines — and
 * a cancelled appointment and one to come sit around it. The list says when
 * he was last seen; his profile lists the history, beside his details on a
 * desktop and under them on a phone; his visit opens its screen, whose back
 * arrow leads back to him. Each screen checked by axe.
 */
test.afterAll(removeAll);

const { patients: words } = UI_TEXT;
const CLINICAL = ["patients.view", "appointments.view", "visits.view", "visits.create", "visits.edit"] as const;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

/** Smile Care: Dr. Maya Rao, and Rohan Mehta seen by her today. */
async function aClinic() {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const [maya, desk] = await Promise.all([
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: [...CLINICAL, "appointments.edit"] }),
    addMember(clinic.clinicId, {
      permissions: [
        "patients.view",
        "patients.create",
        "appointments.view",
        "appointments.create",
        "appointments.edit",
      ],
    }),
  ]);
  await Promise.all([
    admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId),
    admin().from("doctors").update({ registration_number: "KMC 12345" }).eq("member_id", maya.memberId),
  ]);
  const [{ data: doctor }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id").eq("member_id", maya.memberId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  const { data: patient, error } = await desk
    .tenant!.supabase.rpc("create_patient", {
      p_patient: { full_name: "Rohan Mehta", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  const patientId = patient.patient_id;
  const appointment = (at: string, status: string) => ({
    clinic_id: clinic.clinicId,
    patient_id: patientId,
    doctor_id: doctor!.id,
    source: "BOOKED",
    appointment_type_id: type!.id,
    scheduled_at: at,
    duration_minutes: 15,
    status,
    ...(status === "CANCELLED" && { cancel_reason: "Patient asked", cancelled_at: new Date().toISOString() }),
  });
  const booked = await admin()
    .from("appointments")
    .insert([
      appointment(dayHour(addDaysKey(todayKey(), -2), 11), "CANCELLED"),
      appointment(dayHour(addDaysKey(todayKey(), 7), 10), "SCHEDULED"),
    ]);
  if (booked.error) throw booked.error;
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId: doctor!.id, typeId: type!.id }),
    randomUUID(),
  );
  const { visitId } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
  await admin().from("visits").update({ diagnosis: "Dental caries" }).eq("id", visitId);
  const line = { strength: "", dose: "", frequency: "", timing: "", durationDays: "", instructions: "" };
  await savePrescription(
    maya.tenant!,
    visitId,
    savePrescriptionSchema.parse({
      prescription: {
        items: ["Paracetamol", "Amoxicillin", "Metronidazole"].map((medicine) => ({ ...line, medicine })),
        advice: "",
        printDiagnosis: false,
      },
      seen: null,
    }),
  );
  await markDone(desk.tenant!, { appointmentId: arrival.id });
  return { maya, patientId, visitId };
}

test("the list says when a patient was last seen; the profile's history opens the visit, which leads back", async ({
  page,
}, info) => {
  const { maya, patientId, visitId } = await aClinic();
  await signIn(page, maya.email, maya.password);

  // The list: "Last visit: today" on a line of its own (D228, D229).
  await page.goto("/patients");
  const row = page.getByRole("list", { name: UI_TEXT.nav.places.patients }).getByRole("listitem").first();
  await expect(row).toContainText("Rohan Mehta");
  await expect(row).toContainText(words.lastVisitToday);
  await expectAccessible(page);

  // The profile's history: the visit among the appointments, newest first (D225, D226).
  await row.getByRole("link", { name: /^Rohan Mehta/ }).click();
  await expect(page).toHaveURL(`/patients/${patientId}`);
  const history = page.getByRole("region", { name: words.history });
  const entries = history.getByRole("listitem");
  await expect(entries).toHaveCount(3);
  await expect(entries.nth(0)).toContainText("Scheduled");
  const visit = entries.nth(1);
  await expect(visit).toContainText(words.visitOn(formatDate(todayKey())));
  await expect(visit).toContainText("Maya Rao · Dental caries");
  await expect(visit).toContainText("Rx Paracetamol, Amoxicillin +1");
  await expect(visit).toContainText("Done");
  await expect(entries.nth(2)).toContainText("Patient asked");
  await expectAccessible(page);

  // Beside their state on a desktop — its column topped by the next appointment, the treatments and
  // details under it — and under them on a phone (D231, D260).
  const details = page.getByRole("region", { name: words.details });
  const next = page.getByRole("region", { name: words.nextAppointment });
  const [left, right, top] = [
    (await details.boundingBox())!,
    (await history.boundingBox())!,
    (await next.boundingBox())!,
  ];
  if (info.project.name === "desktop") {
    expect(right.x).toBeGreaterThan(left.x + left.width);
    expect(Math.abs(right.y - top.y)).toBeLessThan(200);
  } else {
    expect(right.y).toBeGreaterThanOrEqual(left.y + left.height);
  }

  // The visit opens its screen, whose back arrow returns to the profile (D227, D230).
  await visit.getByRole("link", { name: words.visitOn(formatDate(todayKey())) }).click();
  await expect(page).toHaveURL(`/visits/${visitId}?from=patient`);
  await expect(page.getByRole("heading", { level: 1, name: "Rohan Mehta" })).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("link", { name: UI_TEXT.actions.back }).click();
  await expect(page).toHaveURL(`/patients/${patientId}`);
  await expect(page.getByRole("region", { name: words.history })).toBeVisible();
});
