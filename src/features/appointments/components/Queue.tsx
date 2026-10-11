"use client";

import { CheckCheck, Footprints } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { CoastHeader } from "@/components/ui/coast-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Lake } from "@/components/ui/lake";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { RowList } from "@/components/ui/row";
import { SkeletonRows } from "@/components/ui/skeleton";
import { QUEUE_REFRESH_MS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { ADD_FORMS } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { useDoctors } from "@/features/team/hooks/useDoctors";
import { useAddForm } from "@/hooks/useAddForm";
import { useNow } from "@/hooks/useNow";
import { todayKey } from "@/lib/dates/calendar";
import { formatLongDate } from "@/lib/format/date";

import { firstDoctorFilter } from "../calendar";
import { useOpenedAppointment } from "../hooks/useOpenedAppointment";
import { useQueue } from "../hooks/useQueue";
import { minutesSince, queueSections } from "../queue";
import type { QueueAppointment } from "../types";
import { AppointmentPanel } from "./AppointmentPanel";
import { ComingRow, DoneRow, QueueSection, tokenNumeral, WaitingRow, WithDoctorRow } from "./QueueRows";
import { WalkInSheet } from "./WalkInSheet";

const { queue, appointment: words } = UI_TEXT;

/**
 * Today's queue — `/queue` (plan §11.4; D168 – D175), run by the front desk
 * (D43). It opens on every doctor's for the desk and on a doctor's own for a
 * doctor, switched by the capsules on the land (D170). On a phone the
 * patients with a doctor sit in the lake, then Waiting by token, Still to
 * come, and Done folded (D168); from a tablet up the four sit side by side
 * (D169). A patient still to come is marked late once their time has passed
 * (D174) and has **Arrived** on their row (D172); everything else is in an
 * appointment's detail, a tap away. **Add walk-in** — or the ＋'s Walk-in
 * (D67) — opens its sheet (D171). It is read again every 15 s and on focus
 * (D34), and the minutes waited count on in between.
 *
 * Send in, Done and Next patient come with the visit (R6.1); To bill, with
 * billing (R8.6).
 */
export function Queue() {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const adding = useAddForm(ADD_FORMS.walkIn);
  const doctors = useDoctors().data ?? [];
  const [doctorId, setDoctorId] = useState(() => (membership ? firstDoctorFilter(membership) : ""));
  const query = useQueue(doctorId);
  const now = useNow(QUEUE_REFRESH_MS);
  const opened = useOpenedAppointment();
  const { withDoctor, waiting, stillToCome, done } = queueSections(query.data ?? []);

  const canAdd = membership !== null && hasAccess(membership, "appointments.create");
  const adds = canAdd && !readOnly;
  const edits = membership !== null && hasAccess(membership, "appointments.edit");
  const arrives = edits && !readOnly;
  const showDoctor = !doctorId;
  const open = (appointment: QueueAppointment) => opened.show(appointment);

  let body;
  if (query.data === undefined && query.error != null) {
    body = <LoadFailed query={query} loadFailed="QUEUE_LOAD_FAILED" />;
  } else if (query.data === undefined) {
    body = (
      <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
        <SkeletonRows />
      </section>
    );
  } else {
    body = (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <QueueSection title={queue.waiting} count={waiting.length} empty={queue.noneWaiting}>
          {waiting.map((appointment) => (
            <WaitingRow
              key={appointment.id}
              appointment={appointment}
              now={now}
              showDoctor={showDoctor}
              onOpen={open}
            />
          ))}
        </QueueSection>
        <QueueSection
          className="hidden md:block"
          title={queue.withDoctor}
          count={withDoctor.length}
          empty={queue.noneWithDoctor}
        >
          {withDoctor.map((appointment) => (
            <WithDoctorRow key={appointment.id} appointment={appointment} now={now} onOpen={open} />
          ))}
        </QueueSection>
        <QueueSection title={queue.stillToCome} count={stillToCome.length} empty={queue.noneToCome}>
          {stillToCome.map((appointment) => (
            <ComingRow
              key={appointment.id}
              appointment={appointment}
              now={now}
              showDoctor={showDoctor}
              canRemind={edits}
              canArrive={arrives}
              onOpen={open}
            />
          ))}
        </QueueSection>
        <QueueSection className="hidden md:block" title={queue.done} count={done.length} empty={queue.noneDone}>
          {done.map((appointment) => (
            <DoneRow key={appointment.id} appointment={appointment} showDoctor={showDoctor} onOpen={open} />
          ))}
        </QueueSection>
        {done.length > 0 && (
          <div className="md:hidden">
            <Disclosure
              label={queue.done}
              showLabel={queue.doneCount(done.length)}
              hideLabel={queue.hideDone}
              icon={CheckCheck}
            >
              <RowList label={queue.done}>
                {done.map((appointment) => (
                  <DoneRow key={appointment.id} appointment={appointment} showDoctor={showDoctor} onOpen={open} />
                ))}
              </RowList>
            </Disclosure>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <CoastHeader>
        <div className="grid gap-4 pb-6">
          <PageHeader title={UI_TEXT.nav.places.queue} subtitle={formatLongDate(todayKey())} />
          {doctors.length > 1 && (
            <ChoiceChips
              label={queue.doctors}
              on="land"
              value={doctorId}
              options={[
                { value: "", label: queue.allDoctors },
                ...doctors.map((doctor) => ({ value: doctor.id, label: doctor.name })),
              ]}
              onChange={setDoctorId}
            />
          )}
          {query.data !== undefined && (
            <div className="grid gap-3 md:hidden">
              {withDoctor.length === 0 ? (
                <Lake label={queue.withDoctor} title={queue.roomFree} detail={queue.roomFreeHint} />
              ) : (
                withDoctor.map((appointment) => (
                  <Lake
                    key={appointment.id}
                    label={`${queue.withDoctor}: ${appointment.patientName}`}
                    lead={tokenNumeral(appointment.token)}
                    leadLabel={queue.token}
                    title={appointment.patientName}
                    detail={queue.withDoctorLine(
                      appointment.doctorName ?? words.formerDoctor,
                      queue.minutes(minutesSince(appointment.startedAt, now)),
                    )}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        <div className="grid grid-cols-1 gap-5">
          {canAdd && (
            <div>
              {!readOnly && <Button label={queue.addWalkIn} icon={Footprints} onClick={adding.show} />}
              <ReadOnlyNote />
            </div>
          )}
          {body}
        </div>
      </div>
      {adds && <WalkInSheet key={doctorId} open={adding.open} onClose={adding.close} doctorId={doctorId} />}
      <AppointmentPanel
        key={opened.appointment?.id}
        appointment={opened.appointment}
        open={opened.open}
        onClose={opened.close}
      />
    </>
  );
}
