"use client";

import { UI_TEXT } from "@/constants/messages";
import { apiRoutes } from "@/lib/query/keys";

import { AppointmentTypesClient } from "../api.client";
import { useAppointmentTypes } from "../hooks/useAppointmentTypes";
import { useCatalogueChange } from "../hooks/useCatalogueChange";
import { useEntryEditor } from "../hooks/useEntryEditor";
import type { AppointmentType } from "../types";
import { AppointmentTypeSheet } from "./AppointmentTypeSheet";
import { CatalogueScreen } from "./CatalogueScreen";
import { OrderedCatalogue } from "./OrderedCatalogue";

const { appointmentTypes } = UI_TEXT;
const title = UI_TEXT.settings.items.appointmentTypes.label;

/** How long it usually takes: "15 min". */
const minutesOf = (type: AppointmentType) => appointmentTypes.minutes(type.minutes);

/**
 * Appointment types (plan §9, D32), for `settings.manage`: the kinds of visit
 * the clinic books, each with its usual length, in the clinic's order — new
 * ones join the end (D81). One opens its sheet to be changed or archived;
 * archived ones can be restored (D80); one is always kept (D83).
 */
export function AppointmentTypes() {
  const query = useAppointmentTypes();
  return (
    <CatalogueScreen
      title={title}
      count={appointmentTypes.count}
      query={query}
      loadFailed="APPOINTMENT_TYPES_LOAD_FAILED"
    >
      {(types) => <Types types={types} />}
    </CatalogueScreen>
  );
}

function Types({ types }: { types: readonly AppointmentType[] }) {
  const editor = useEntryEditor<AppointmentType>();
  const { restore, restoring } = useCatalogueChange({
    change: AppointmentTypesClient.change,
    list: apiRoutes.appointmentTypes.list,
  });

  return (
    <>
      <OrderedCatalogue
        entries={types}
        label={title}
        detail={minutesOf}
        addLabel={appointmentTypes.add}
        orderNote={appointmentTypes.order}
        onAdd={editor.add}
        onEdit={editor.edit}
        onRestore={(type) => void restore(type)}
        restoring={restoring}
      />
      <AppointmentTypeSheet key={editor.key} open={editor.open} onClose={editor.close} type={editor.entry} />
    </>
  );
}
