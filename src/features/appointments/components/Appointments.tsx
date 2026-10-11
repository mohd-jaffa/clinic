"use client";

import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { PageHeader } from "@/components/ui/page-header";
import { UI_TEXT } from "@/constants/messages";
import { ADD_FORMS } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { useAddForm } from "@/hooks/useAddForm";

import { BookingSheet } from "./BookingSheet";

/**
 * Appointments (plan §11.5): **Book appointment** for those who may
 * (`appointments.create`), opened as well by the ＋'s Appointment (D67). The
 * calendar joins it next (R5.3). In a view-only clinic nothing is booked,
 * and it says why.
 */
export function Appointments() {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const adding = useAddForm(ADD_FORMS.appointment);
  const canBook = membership !== null && hasAccess(membership, "appointments.create");

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={UI_TEXT.nav.places.appointments} />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        <div className="grid max-w-3xl grid-cols-1 gap-8">
          {canBook && (
            <div>
              {!readOnly && <Button label={UI_TEXT.appointments.book} icon={CalendarPlus} onClick={adding.show} />}
              <ReadOnlyNote />
            </div>
          )}
        </div>
      </div>
      {canBook && !readOnly && <BookingSheet open={adding.open} onClose={adding.close} />}
    </>
  );
}
