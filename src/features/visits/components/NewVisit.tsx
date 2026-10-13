"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Stethoscope } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/ui/form-sheet";
import { SelectField } from "@/components/ui/select-field";
import { UI_TEXT } from "@/constants/messages";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { useDoctors } from "@/features/team/hooks/useDoctors";
import { FORM_RESET_OPTIONS, startVisitSchema, type StartVisitInput } from "@/lib/validation";

import { useStartVisit } from "../hooks/useVisitMoves";

const { visit: words, appointments, appointment } = UI_TEXT;

/**
 * **New visit** on a patient's profile (plan §12.1; D204), for `visits.create`
 * — and `visits.view`, to open it — while the clinic can write and the
 * patient is not archived. A doctor starts their own at once; anyone else
 * chooses the doctor first, their own or the only one already chosen. The
 * visit opens; one already open with that doctor is opened instead.
 */
export function NewVisit({ patient }: { patient: { id: string; name: string; archivedAt: string | null } }) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const doctors = useDoctors().data ?? [];
  const [sheet, setSheet] = useState({ open: false, count: 0 });
  const nameOf = (doctorId: string) =>
    doctors.find((doctor) => doctor.id === doctorId)?.name ?? appointment.formerDoctor;
  const starting = useStartVisit(patient, nameOf);
  if (
    membership === null ||
    !hasAccess(membership, "visits.create") ||
    !hasAccess(membership, "visits.view") ||
    readOnly ||
    patient.archivedAt
  ) {
    return null;
  }
  const own = membership.role === "DOCTOR" ? membership.doctorId : null;
  return (
    <>
      <Button
        label={words.newVisit}
        icon={Stethoscope}
        variant="secondary"
        size="sm"
        loading={own ? starting.starting : false}
        onClick={() =>
          own
            ? void starting.start({ patientId: patient.id, doctorId: own })
            : setSheet(({ count }) => ({ open: true, count: count + 1 }))
        }
      />
      {!own && (
        <NewVisitSheet
          key={sheet.count}
          open={sheet.open}
          onClose={() => setSheet((now) => ({ ...now, open: false }))}
          patientId={patient.id}
          firstDoctor={membership.doctorId ?? (doctors.length === 1 ? doctors[0].id : "")}
          doctors={doctors}
          starting={starting}
        />
      )}
    </>
  );
}

/** Whose visit it is to be: the doctor, then **Start visit**. */
function NewVisitSheet({
  open,
  onClose,
  patientId,
  firstDoctor,
  doctors,
  starting,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  firstDoctor: string;
  doctors: readonly { id: string; name: string }[];
  starting: ReturnType<typeof useStartVisit>;
}) {
  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<StartVisitInput>({
    resolver: zodResolver(startVisitSchema) as unknown as Resolver<StartVisitInput>,
    defaultValues: { patientId, doctorId: firstDoctor },
    resetOptions: FORM_RESET_OPTIONS,
  });
  return (
    <FormSheet
      open={open}
      title={words.newVisit}
      onClose={onClose}
      submitLabel={words.startVisit}
      onSubmit={handleSubmit(async () => {
        if (await starting.start(startVisitSchema.parse(getValues()))) onClose();
      })}
      submitting={starting.starting}
    >
      <Controller
        control={control}
        name="doctorId"
        render={({ field }) => (
          <SelectField
            ref={field.ref}
            label={appointments.doctorLabel}
            options={doctors.map(({ id, name }) => ({ value: id, label: name }))}
            placeholder={field.value ? undefined : appointments.chooseDoctor}
            required
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.doctorId?.message}
          />
        )}
      />
    </FormSheet>
  );
}
