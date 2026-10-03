"use client";

import { UserPlus } from "lucide-react";

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

import { PatientSheet } from "./PatientSheet";

const { patients } = UI_TEXT;

/**
 * Patients (plan §10.2): **Add patient** for those who may (`patients.create`),
 * opened as well by the ＋'s Patient (D67). In a view-only clinic nothing is
 * added, and it says why.
 */
export function Patients() {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const adding = useAddForm(ADD_FORMS.patient);
  const canAdd = membership !== null && hasAccess(membership, "patients.create");

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={UI_TEXT.nav.places.patients} />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        <div className="grid max-w-3xl grid-cols-1 gap-8">
          {canAdd && (
            <div>
              {!readOnly && <Button label={patients.add} icon={UserPlus} onClick={adding.show} />}
              <ReadOnlyNote />
            </div>
          )}
        </div>
      </div>
      {canAdd && !readOnly && <PatientSheet open={adding.open} onClose={adding.close} />}
    </>
  );
}
