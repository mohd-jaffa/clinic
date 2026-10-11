"use client";

import { MessageCircle, Pencil, Phone } from "lucide-react";
import { useId, useState } from "react";

import { Button, LinkButton } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { DetailList, type Detail } from "@/components/ui/detail-list";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonRows } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import { PATIENTS_ROUTE } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { AppointmentPanel } from "@/features/appointments/components/AppointmentPanel";
import { useOpenedAppointment } from "@/features/appointments/hooks/useOpenedAppointment";
import { useAuth } from "@/features/auth/AuthProvider";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { formatDate } from "@/lib/format/date";
import { callHref, formatPhoneDigits, whatsAppHref } from "@/lib/phone";

import { describePatient } from "../describe";
import { usePatient } from "../hooks/usePatient";
import type { Patient } from "../types";
import { NextAppointment } from "./NextAppointment";
import { PatientAlerts } from "./PatientAlerts";
import { PatientArchived } from "./PatientArchived";
import { PatientHistory } from "./PatientHistory";
import { PatientSheet } from "./PatientSheet";

const { patients } = UI_TEXT;

/**
 * What a patient's details hold, in the order the sheet asks for them (D113):
 * the mobile always; the date of birth when it was given as one, not an age.
 */
function detailsOf(patient: Patient): Detail[] {
  const emergency = [patient.emergencyContactName, patient.emergencyContactPhone].filter(Boolean).join(" · ");
  const lines: [string, string | null][] = [
    [patients.mobileLabel, `${UI_TEXT.fields.phonePrefix} ${formatPhoneDigits(patient.phone)}`],
    [patients.dateOfBirthLabel, patient.dobIsEstimated ? null : formatDate(patient.dateOfBirth)],
    [patients.altPhoneLabel, patient.altPhone],
    [patients.emailLabel, patient.email],
    [patients.addressLabel, patient.address],
    [patients.emergencyNameLabel, emergency || null],
    [patients.notesLabel, patient.notes],
  ];
  return lines.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

/**
 * A patient's profile (plan §10.3, D113 – D117, D123), for `patients.view` —
 * a doctor's own only (D3): who they are — age, gender, number and their
 * doctor — whether they are archived, their alerts, and **Call** and
 * **WhatsApp** (a chat, nothing typed); then their details, only what holds a
 * value, notes included, with **Edit** for those who may change them. For
 * those who see appointments, their next appointment — or **Book** — and
 * their history of appointments, each opening its detail (D166, D167). One
 * column until visits arrive (D114); each later phase adds its part (D101).
 */
export function PatientProfile({ id }: { id: string }) {
  const query = usePatient(id);
  const patient = query.data;
  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader
            title={patient?.name ?? UI_TEXT.nav.places.patients}
            subtitle={patient && describePatient(patient)}
            detail={patient && (patient.doctorName ? patients.doctorLine(patient.doctorName) : patients.noDoctor)}
            actions={
              patient && (
                <>
                  {patient.archivedAt && <PatientArchived patient={patient} archivedAt={patient.archivedAt} />}
                  <PatientAlerts patient={patient} />
                  <Reach patient={patient} />
                </>
              )
            }
            back={PATIENTS_ROUTE}
          />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        {patient ? (
          <Body patient={patient} />
        ) : query.error != null ? (
          <LoadFailed query={query} loadFailed="PATIENT_LOAD_FAILED" />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={4} />
          </section>
        )}
      </div>
    </>
  );
}

/** Call, and a WhatsApp chat with nothing typed (D115). */
function Reach({ patient }: { patient: Patient }) {
  return (
    <div className="flex flex-wrap gap-2">
      <LinkButton
        href={callHref(patient.phone)}
        label={patients.callLabel}
        accessibleName={patients.call(patient.name)}
        icon={Phone}
        size="sm"
      />
      <LinkButton
        href={whatsAppHref(patient.phone)}
        label={patients.whatsAppLabel}
        accessibleName={patients.whatsAppTo(patient.name)}
        icon={MessageCircle}
        variant="secondary"
        size="sm"
        newTab
      />
    </div>
  );
}

/**
 * The profile's parts, in one column (D114): their next appointment, their
 * details, their history — the appointments ones for `appointments.view` —
 * and the detail of an appointment opened from either (D160).
 */
function Body({ patient }: { patient: Patient }) {
  const { membership } = useAuth();
  const opened = useOpenedAppointment();
  const seesAppointments = membership !== null && hasAccess(membership, "appointments.view");
  const mayEdit = membership !== null && hasAccess(membership, "patients.edit");

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      {mayEdit && <ReadOnlyNote />}
      {seesAppointments && <NextAppointment patient={patient} onOpen={opened.show} />}
      <Details patient={patient} mayEdit={mayEdit} />
      {seesAppointments && (
        <>
          <PatientHistory patient={patient} onOpen={opened.show} />
          <AppointmentPanel
            key={opened.appointment?.id}
            appointment={opened.appointment}
            open={opened.open}
            onClose={opened.close}
            linkProfile={false}
          />
        </>
      )}
    </div>
  );
}

/** What holds a value of their details (D113), and Edit — not for an archived patient (D103). */
function Details({ patient, mayEdit }: { patient: Patient; mayEdit: boolean }) {
  const { readOnly } = useReadOnly();
  const [editing, setEditing] = useState(false);
  const headingId = useId();
  const edits = mayEdit && !readOnly && !patient.archivedAt;

  return (
    <>
      <section aria-labelledby={headingId}>
        <SectionHeading id={headingId} title={patients.details}>
          {edits && (
            <Button
              label={patients.edit}
              aria-label={patients.editName(patient.name)}
              icon={Pencil}
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
            />
          )}
        </SectionHeading>
        <DetailList details={detailsOf(patient)} />
      </section>
      {edits && <PatientSheet open={editing} onClose={() => setEditing(false)} patient={patient} />}
    </>
  );
}
