"use client";

import { Archive, FileUp, UserPlus, UsersRound } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button, LinkButton } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row";
import { SearchField } from "@/components/ui/search-field";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { UI_TEXT } from "@/constants/messages";
import { ADD_FORMS, IMPORT_ROUTE, patientRoute } from "@/constants/navigation";
import { hasAccess, ROUTE_ACCESS } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { useAddForm } from "@/hooks/useAddForm";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatPhoneDigits } from "@/lib/phone";
import { PATIENT_TABS, type PatientTab } from "@/lib/validation";

import { describePatient, lastVisitLine } from "../describe";
import { usePatients } from "../hooks/usePatients";
import type { PatientListItem } from "../types";
import { prefillFrom, type PatientPrefill } from "../prefill";
import { PatientSheet } from "./PatientSheet";

const { patients } = UI_TEXT;
const TAB_OPTIONS = PATIENT_TABS.map((tab) => ({ value: tab, label: patients.tabs[tab] }));

/**
 * Patients (plan §10.2, D104, D111, D112, D121): searched by name, mobile or
 * number — in the body, never the address (D98) — newest first with nothing
 * typed, a page at a time. Each row gives age, gender and number — the mobile
 * too, wider than a phone — and the last visit, and opens the profile, where
 * Call and WhatsApp are. A doctor finds only
 * their own patients; the archived wait on their own tab for those who may
 * restore them. **Add patient**, or the ＋'s Patient, opens the sheet; a
 * search that found no one offers it with what was typed. A clinic with no
 * patients yet offers its owner **Import from a file** (D132).
 */
export function Patients() {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const adding = useAddForm(ADD_FORMS.patient);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<PatientTab>("ALL");
  const [prefill, setPrefill] = useState<{ count: number; values: PatientPrefill }>({ count: 0, values: {} });
  const tabsId = useId();
  const searched = useDebouncedValue(search.trim());
  const query = usePatients(searched, tab);

  const canAdd = membership !== null && hasAccess(membership, "patients.create");
  const seesArchived = membership !== null && hasAccess(membership, "patients.edit");
  const adds = canAdd && !readOnly;
  // Someone moving from a spreadsheet looks here first (D132).
  const imports = membership !== null && hasAccess(membership, ROUTE_ACCESS.owner) && !readOnly;
  const addTyped = () => {
    setPrefill(({ count }) => ({ count: count + 1, values: prefillFrom(searched) }));
    adding.show();
  };

  const list = (
    <ListScreen
      query={query}
      loadFailed="PATIENTS_LOAD_FAILED"
      data={query.data}
      empty={
        tab === "ARCHIVED" ? (
          <EmptyState icon={Archive} title={patients.archivedEmptyTitle} hint={patients.archivedEmptyHint} />
        ) : (
          <EmptyState
            icon={UsersRound}
            title={patients.emptyTitle}
            hint={membership?.role === "DOCTOR" ? patients.emptyHintDoctor : patients.emptyHint}
            action={
              imports && (
                <LinkButton
                  href={IMPORT_ROUTE}
                  label={UI_TEXT.patientImport.fromEmpty}
                  icon={FileUp}
                  variant="secondary"
                />
              )
            }
          />
        )
      }
      noMatches={searched && <NoMatches search={searched} onAdd={adds && tab === "ALL" ? addTyped : undefined} />}
      renderList={(rows) => (
        <RowList label={UI_TEXT.nav.places.patients}>
          {rows.map((patient) => (
            <PatientListRow key={patient.id} patient={patient} />
          ))}
        </RowList>
      )}
    />
  );

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader
            title={UI_TEXT.nav.places.patients}
            subtitle={membership?.role === "DOCTOR" ? patients.yours : undefined}
          />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        <div className="grid max-w-3xl grid-cols-1 gap-6">
          {canAdd && (
            <div>
              {!readOnly && <Button label={patients.add} icon={UserPlus} onClick={adding.show} />}
              <ReadOnlyNote />
            </div>
          )}
          <SearchField value={search} onChange={setSearch} placeholder={patients.searchPlaceholder} />
          {seesArchived ? (
            <div>
              <Tabs id={tabsId} label={patients.tabsLabel} value={tab} options={TAB_OPTIONS} onChange={setTab} />
              <TabPanel id={tabsId} value={tab}>
                {list}
              </TabPanel>
            </div>
          ) : (
            list
          )}
        </div>
      </div>
      {adds && <PatientSheet key={prefill.count} open={adding.open} onClose={adding.close} prefill={prefill.values} />}
    </>
  );
}

/**
 * One patient in the list (D121), opening their profile — where Call is. The
 * mobile joins the line from 640 px; on a phone it would only be cut short.
 * Their last visit has a line of its own under it (D229).
 */
function PatientListRow({ patient }: { patient: PatientListItem }) {
  return (
    <Row
      leading={<Avatar name={patient.name} />}
      title={patient.name}
      subtitle={
        <>
          {describePatient(patient)}
          <span className="hidden sm:inline">{` · ${formatPhoneDigits(patient.phone)}`}</span>
        </>
      }
      note={lastVisitLine(patient.lastVisitOn)}
      href={patientRoute(patient.id)}
    />
  );
}

/** A search that found no one (D112): said so, and — for those who may add — Add patient with what was typed. */
function NoMatches({ search, onAdd }: { search: string; onAdd?: () => void }): ReactNode {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div>
        <p className="font-bold text-ink">{patients.noMatches(search)}</p>
        {onAdd && <p className="mt-1 text-small text-muted">{patients.noMatchesHint}</p>}
      </div>
      {onAdd && <Button label={patients.add} icon={UserPlus} variant="secondary" onClick={onAdd} />}
    </div>
  );
}
